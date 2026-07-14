import type { LiveInstrument, MarketBar } from "./market-types";

const YAHOO_SYMBOL: Record<LiveInstrument, string> = {
  NQ: "NQ=F",
  ES: "ES=F",
};

function yahooChartUrl(symbol: string): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=false`;
}

export async function fetchYahooBars(instrument: LiveInstrument): Promise<{
  bars: MarketBar[];
  source: "yahoo" | "demo" | "bridge";
  symbol: string;
  error?: string;
}> {
  const symbol = YAHOO_SYMBOL[instrument];

  // Prefer local Rithmic bridge if configured / running
  const bridge = await tryBridgeBars(instrument);
  if (bridge) return bridge;

  try {
    const res = await fetch(yahooChartUrl(symbol), {
      headers: {
        "User-Agent": "TradingJournal/1.0",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }>;
          };
        }>;
      };
    };

    const result = json.chart?.result?.[0];
    const ts = result?.timestamp ?? [];
    const q = result?.indicators?.quote?.[0];
    if (!ts.length || !q) throw new Error("Empty Yahoo chart");

    const bars: MarketBar[] = [];
    for (let i = 0; i < ts.length; i++) {
      const open = q.open?.[i];
      const high = q.high?.[i];
      const low = q.low?.[i];
      const close = q.close?.[i];
      const volume = q.volume?.[i] ?? 0;
      if (open == null || high == null || low == null || close == null) continue;
      if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
      bars.push({
        time: ts[i],
        open,
        high,
        low,
        close,
        volume: Math.max(0, volume ?? 0),
      });
    }

    if (bars.length < 20) throw new Error(`Too few bars: ${bars.length}`);
    return { bars, source: "yahoo", symbol };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Yahoo failed";
    return {
      bars: generateDemoBars(instrument),
      source: "demo",
      symbol,
      error: message,
    };
  }
}

async function tryBridgeBars(instrument: LiveInstrument): Promise<{
  bars: MarketBar[];
  source: "bridge";
  symbol: string;
} | null> {
  const base = process.env.RITHMIC_BRIDGE_URL ?? "http://127.0.0.1:7788";
  try {
    const res = await fetch(`${base}/bars?symbol=${instrument}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { bars?: MarketBar[]; symbol?: string };
    if (!data.bars?.length) return null;
    return {
      bars: data.bars,
      source: "bridge",
      symbol: data.symbol ?? instrument,
    };
  } catch {
    return null;
  }
}

function generateDemoBars(instrument: LiveInstrument): MarketBar[] {
  const base = instrument === "NQ" ? 21850 : 5980;
  const tick = 0.25;
  const now = Math.floor(Date.now() / 1000);
  const start = now - 390 * 60;
  const bars: MarketBar[] = [];
  let price = base;
  let seed = instrument === "NQ" ? 42 : 7;

  function rnd() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  const vah = base + 40;
  const val = base - 35;

  for (let i = 0; i < 390; i++) {
    const t = start + i * 60;
    const phase = i / 390;
    const target =
      phase < 0.2
        ? val + (vah - val) * 0.3
        : phase < 0.35
          ? vah
          : phase < 0.55
            ? (vah + val) / 2
            : phase < 0.7
              ? val
              : phase < 0.85
                ? vah - 5
                : (vah + val) / 2;

    const drift = (target - price) * 0.08;
    const noise = (rnd() - 0.5) * 8;
    const open = price;
    const close = price + drift + noise;
    const high = Math.max(open, close) + rnd() * 3;
    const low = Math.min(open, close) - rnd() * 3;
    const mid = (vah + val) / 2;
    const dist = Math.abs(close - mid) / ((vah - val) / 2);
    const volBase = 800 + dist * 2200 + rnd() * 400;

    bars.push({
      time: t,
      open: roundTick(open, tick),
      high: roundTick(high, tick),
      low: roundTick(low, tick),
      close: roundTick(close, tick),
      volume: Math.round(volBase),
    });
    price = close;
  }

  return bars;
}

function roundTick(price: number, tick: number): number {
  return Math.round(price / tick) * tick;
}
