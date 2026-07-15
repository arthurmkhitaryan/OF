import type { LiveInstrument, MarketBar } from "./market-types";
import { fillBarGaps, recentBars } from "./bar-utils";

/** Drop spike bars that blow the Y scale (bad ticks / out-of-band prints). */
export function sanitizeMarketBars(
  instrument: LiveInstrument,
  bars: MarketBar[]
): MarketBar[] {
  if (bars.length < 20) return bars;
  const closes = [...bars.map((b) => b.close)].sort((a, b) => a - b);
  const med = closes[Math.floor(closes.length / 2)]!;
  const lim = instrument === "NQ" ? 350 : 40;
  const cleaned = bars.filter(
    (b) =>
      Math.abs(b.close - med) <= lim &&
      Math.abs(b.high - med) <= lim &&
      Math.abs(b.low - med) <= lim
  );
  return cleaned.length >= 20 ? cleaned : bars;
}

/**
 * Market bars from local Rithmic bridge only (no Yahoo / demo).
 */
export async function fetchMarketBars(instrument: LiveInstrument): Promise<{
  bars: MarketBar[];
  source: "bridge" | "none";
  symbol: string;
  error?: string;
}> {
  const base = process.env.RITHMIC_BRIDGE_URL ?? "http://127.0.0.1:7788";
  try {
    const res = await fetch(`${base}/bars?symbol=${instrument}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as {
      bars?: MarketBar[];
      symbol?: string;
      contract?: string;
      error?: string;
      detail?: string;
      source?: string;
    };

    if (!res.ok) {
      const stale =
        data.error === "bars_via_yahoo" ||
        (data.detail || "").includes("Yahoo");
      return {
        bars: [],
        source: "none",
        symbol: instrument,
        error: stale
          ? "Старый bridge без Rithmic bars — Ctrl+C и снова: npm run bridge"
          : data.detail ||
            data.error ||
            `Rithmic bridge HTTP ${res.status} — npm run bridge`,
      };
    }

    const raw = (data.bars ?? []).filter(
      (b) =>
        b &&
        Number.isFinite(b.time) &&
        Number.isFinite(b.open) &&
        Number.isFinite(b.close)
    );
    const cleaned = sanitizeMarketBars(instrument, raw);
    const bars = recentBars(fillBarGaps(cleaned), 6);

    if (bars.length < 5) {
      return {
        bars,
        source: bars.length ? "bridge" : "none",
        symbol: data.contract ?? data.symbol ?? instrument,
        error:
          bars.length === 0
            ? "Rithmic: нет баров ещё (история грузится)"
            : undefined,
      };
    }

    return {
      bars,
      source: "bridge",
      symbol: data.contract ?? data.symbol ?? instrument,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Rithmic bridge unreachable";
    return {
      bars: [],
      source: "none",
      symbol: instrument,
      error: `${message} — npm run bridge`,
    };
  }
}

/** @deprecated use fetchMarketBars */
export const fetchYahooBars = fetchMarketBars;
