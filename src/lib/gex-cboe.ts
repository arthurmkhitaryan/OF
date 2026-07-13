import type { GexInstrument, GexStrikeBar } from "./gex";

export type { GexStrikeBar };

const CBOE_OPTIONS_URL =
  "https://cdn.cboe.com/api/global/delayed_quotes/options";
const CBOE_QUOTE_URL =
  "https://cdn.cboe.com/api/global/delayed_quotes/quotes";

/** Near-term only — leaps distort walls */
const MAX_DTE = 21;
/** Extra weight for 0–7 DTE (SpotGamma-style focus) */
const NEAR_DTE = 7;
const NEAR_WEIGHT = 1.75;
/** Band for walls / HVL */
const WALL_BAND = 0.025; // ±2.5%
/** Wider band for chart */
const CHART_BAND = 0.05; // ±5%

interface CboeOption {
  option: string;
  gamma: number;
  open_interest: number;
  volume: number;
  iv?: number;
}

interface CboeOptionsResponse {
  timestamp?: string;
  data: {
    options: CboeOption[];
    current_price: number;
    symbol?: string;
  };
}

interface CboeQuoteResponse {
  timestamp?: string;
  data: { current_price: number; symbol?: string };
}

export interface ComputedGexLevels {
  instrument: GexInstrument;
  proxy: string;
  spot: number;
  zeroGamma: number | null;
  callWall: number | null;
  putWall: number | null;
  hvl: number | null;
  source: "CBOE";
  notes: string;
  timestamp: string;
  optionCount: number;
  profile: GexStrikeBar[];
  confidence: "high" | "medium" | "low";
}

function parseOption(optionSymbol: string): {
  right: "C" | "P";
  strike: number;
  dte: number;
} | null {
  const m = optionSymbol.match(/^[A-Z]+(\d{6})([CP])(\d{8})$/);
  if (!m) return null;

  const yymmdd = m[1];
  const year = 2000 + parseInt(yymmdd.slice(0, 2), 10);
  const month = parseInt(yymmdd.slice(2, 4), 10) - 1;
  const day = parseInt(yymmdd.slice(4, 6), 10);
  const expiry = new Date(Date.UTC(year, month, day, 21, 0, 0));
  const dte = Math.ceil((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  return {
    right: m[2] as "C" | "P",
    strike: parseInt(m[3], 10) / 1000,
    dte,
  };
}

type StrikeAgg = { net: number; call: number; put: number; volume: number };

function roundLevel(value: number, instrument: GexInstrument): number {
  // NQ/NDX typically trade in 25s; ES/SPX in 5s/10s
  const step = instrument === "NQ" ? 25 : 5;
  return Math.round(value / step) * step;
}

/**
 * Dealer GEX per 1% (SpotGamma / Perfiliev convention):
 * Call = +γ·OI·100·S²·0.01 ; Put = −γ·OI·100·S²·0.01
 *
 * Walls use **net GEX** inside ±2.5% of spot (not deep OTM OI).
 * NQ uses liquid **QQQ** chain scaled to NDX index levels.
 */
export function computeGexLevels(
  options: CboeOption[],
  chainSpot: number,
  displaySpot: number,
  scale: number,
  instrument: GexInstrument,
  proxy: string,
  timestamp: string,
  volSumHint?: number
): ComputedGexLevels {
  const scaleFactor = 100 * chainSpot * chainSpot * 0.01;
  const byStrike = new Map<number, StrikeAgg>();

  let used = 0;
  let volSum = 0;

  for (const opt of options) {
    const parsed = parseOption(opt.option);
    if (!parsed) continue;
    if (parsed.dte < 0 || parsed.dte > MAX_DTE) continue;
    if (Math.abs(parsed.strike - chainSpot) / chainSpot > CHART_BAND) continue;
    if (!opt.gamma || !opt.open_interest) continue;

    const weight = parsed.dte <= NEAR_DTE ? NEAR_WEIGHT : 1;
    const gex = opt.gamma * opt.open_interest * scaleFactor * weight;
    const signed = parsed.right === "C" ? gex : -gex;

    // Map chain strike → display (index/futures) strike
    const displayStrike = roundLevel(parsed.strike * scale, instrument);

    const row = byStrike.get(displayStrike) ?? {
      net: 0,
      call: 0,
      put: 0,
      volume: 0,
    };
    row.net += signed;
    if (parsed.right === "C") row.call += gex;
    else row.put += -gex;
    row.volume += opt.volume || 0;
    volSum += opt.volume || 0;
    byStrike.set(displayStrike, row);
    used += 1;
  }

  const strikes = Array.from(byStrike.entries()).sort((a, b) => a[0] - b[0]);
  const spot = displaySpot;

  // Walls: max/min **net** GEX on the correct side of spot
  const callCandidates = strikes.filter(
    ([s, r]) => s >= spot && s <= spot * (1 + WALL_BAND) && r.net > 0
  );
  const putCandidates = strikes.filter(
    ([s, r]) => s <= spot && s >= spot * (1 - WALL_BAND) && r.net < 0
  );
  const nearAll = strikes.filter(
    ([s]) => Math.abs(s - spot) / spot <= WALL_BAND
  );

  const callWall =
    callCandidates.length > 0
      ? callCandidates.reduce((a, b) => (b[1].net > a[1].net ? b : a))[0]
      : null;

  const putWall =
    putCandidates.length > 0
      ? putCandidates.reduce((a, b) => (b[1].net < a[1].net ? b : a))[0]
      : null;

  const hvl =
    nearAll.length > 0
      ? nearAll.reduce((a, b) => (b[1].volume > a[1].volume ? b : a))[0]
      : null;

  // Zero gamma: cumulative net flip nearest spot
  let zeroGamma: number | null = null;
  let cum = 0;
  let bestDist = Infinity;
  let prevCum = 0;
  for (const [strike, row] of strikes) {
    prevCum = cum;
    cum += row.net;
    if ((prevCum < 0 && cum >= 0) || (prevCum > 0 && cum <= 0)) {
      const dist = Math.abs(strike - spot);
      if (dist < bestDist) {
        bestDist = dist;
        zeroGamma = strike;
      }
    }
  }
  if (zeroGamma == null && nearAll.length > 0) {
    zeroGamma = nearAll.reduce((a, b) =>
      Math.abs(a[1].net) < Math.abs(b[1].net) ? a : b
    )[0];
  }

  const profile: GexStrikeBar[] = strikes.map(([strike, row]) => ({
    strike,
    volume: Math.round(row.volume),
    netGex: Math.round(row.net),
    callGex: Math.round(row.call),
    putGex: Math.round(row.put),
  }));

  const totalVol = volSumHint ?? volSum;
  const confidence: ComputedGexLevels["confidence"] =
    totalVol >= 100_000 ? "high" : totalVol >= 20_000 ? "medium" : "low";

  return {
    instrument,
    proxy,
    spot: Math.round(spot * 100) / 100,
    zeroGamma,
    callWall,
    putWall,
    hvl,
    source: "CBOE",
    notes: `CBOE ${proxy} → ${instrument} | DTE 0–${MAX_DTE} (×${NEAR_WEIGHT} для ≤${NEAR_DTE}d) | стены net GEX ±${WALL_BAND * 100}% | vol ${Math.round(totalVol).toLocaleString()} | confidence: ${confidence}`,
    timestamp,
    optionCount: used,
    profile,
    confidence,
  };
}

async function fetchCboeOptions(symbol: string): Promise<CboeOptionsResponse> {
  const res = await fetch(`${CBOE_OPTIONS_URL}/${symbol}.json`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TradingJournal/1.0 (GEX)",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CBOE options ${symbol} HTTP ${res.status}`);
  return (await res.json()) as CboeOptionsResponse;
}

async function fetchCboeQuote(symbol: string): Promise<CboeQuoteResponse> {
  const res = await fetch(`${CBOE_QUOTE_URL}/${symbol}.json`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TradingJournal/1.0 (GEX)",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CBOE quote ${symbol} HTTP ${res.status}`);
  return (await res.json()) as CboeQuoteResponse;
}

/**
 * ES ← SPX (index options, liquid enough)
 * NQ ← QQQ (ETF options far more liquid than NDX), scaled to NDX level
 */
export async function fetchLiveGex(
  instruments: GexInstrument[] = ["ES", "NQ"]
): Promise<ComputedGexLevels[]> {
  return Promise.all(
    instruments.map(async (instrument) => {
      if (instrument === "ES") {
        const json = await fetchCboeOptions("_SPX");
        const spot = json.data.current_price;
        if (!spot || !json.data.options?.length) {
          throw new Error("CBOE SPX: нет цены или опционов");
        }
        return computeGexLevels(
          json.data.options,
          spot,
          spot,
          1,
          "ES",
          "SPX",
          json.timestamp ?? new Date().toISOString()
        );
      }

      // NQ: QQQ chain + NDX spot for display scale
      const [qqq, ndxQuote] = await Promise.all([
        fetchCboeOptions("QQQ"),
        fetchCboeQuote("_NDX"),
      ]);
      const qqqSpot = qqq.data.current_price;
      const ndxSpot = ndxQuote.data.current_price;
      if (!qqqSpot || !ndxSpot || !qqq.data.options?.length) {
        throw new Error("CBOE QQQ/NDX: нет цены или опционов");
      }
      const scale = ndxSpot / qqqSpot;
      return computeGexLevels(
        qqq.data.options,
        qqqSpot,
        ndxSpot,
        scale,
        "NQ",
        `QQQ→NDX (×${scale.toFixed(2)})`,
        qqq.timestamp ?? ndxQuote.timestamp ?? new Date().toISOString()
      );
    })
  );
}
