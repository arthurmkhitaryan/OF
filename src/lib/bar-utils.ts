import type { MarketBar, TickPrint } from "./market-types";

/** Fill missing 1m slots so the chart looks continuous (session gaps → flat candles). */
export function fillBarGaps(bars: MarketBar[], maxGapMinutes = 45): MarketBar[] {
  if (bars.length < 2) return bars;
  const out: MarketBar[] = [bars[0]!];
  for (let i = 1; i < bars.length; i++) {
    const prev = out[out.length - 1]!;
    const cur = bars[i]!;
    let t = prev.time + 60;
    let filled = 0;
    while (t < cur.time && filled < maxGapMinutes) {
      out.push({
        time: t,
        open: prev.close,
        high: prev.close,
        low: prev.close,
        close: prev.close,
        volume: 0,
      });
      t += 60;
      filled += 1;
    }
    out.push(cur);
  }
  return out;
}

/** Apply tape prints onto 1m bars (creates new minutes when clock advances). */
export function applyPrintsToBars(
  bars: MarketBar[],
  prints: TickPrint[]
): MarketBar[] {
  if (!bars.length) return bars;
  if (!prints.length) return bars;

  const out = bars.map((b) => ({ ...b }));
  for (const p of prints) {
    const minute = Math.floor(p.time) - (Math.floor(p.time) % 60);
    const last = out[out.length - 1]!;
    if (minute > last.time) {
      out.push({
        time: minute,
        open: last.close,
        high: Math.max(last.close, p.price),
        low: Math.min(last.close, p.price),
        close: p.price,
        volume: p.size,
      });
    } else if (minute === last.time) {
      last.high = Math.max(last.high, p.price);
      last.low = Math.min(last.low, p.price);
      last.close = p.price;
      last.volume += p.size;
    } else {
      // late print into earlier bar — find or skip
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i]!.time === minute) {
          const b = out[i]!;
          b.high = Math.max(b.high, p.price);
          b.low = Math.min(b.low, p.price);
          b.close = p.price;
          b.volume += p.size;
          break;
        }
        if (out[i]!.time < minute) break;
      }
    }
  }
  // keep chart from growing forever in UI
  if (out.length > 600) return out.slice(-600);
  return out;
}

/** Prefer last ~3h so candles look dense on screen */
export function recentBars(bars: MarketBar[], hours = 4): MarketBar[] {
  if (!bars.length) return bars;
  const cut = bars[bars.length - 1]!.time - hours * 3600;
  const slice = bars.filter((b) => b.time >= cut);
  return slice.length >= 30 ? slice : bars.slice(-180);
}
