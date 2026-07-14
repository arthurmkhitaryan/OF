import type { OrderFlowEvent } from "./market-types";

/**
 * Keep the chart readable: few markers, one per minute, prefer Big > Abs > Trp.
 */
export function pickChartMarkers(
  events: OrderFlowEvent[],
  opts?: { max?: number; lookbackSec?: number; types?: OrderFlowEvent["type"][] }
): OrderFlowEvent[] {
  const max = opts?.max ?? 6;
  const lookbackSec = opts?.lookbackSec ?? 45 * 60;
  const allowed = new Set(opts?.types ?? ["BIG_TRADE", "ABSORPTION", "TRAPPED"]);
  const now = Math.max(...events.map((e) => e.time), Math.floor(Date.now() / 1000));
  const rank = (t: OrderFlowEvent["type"]) =>
    t === "BIG_TRADE" ? 3 : t === "ABSORPTION" ? 2 : 1;

  const recent = events
    .filter((e) => allowed.has(e.type) && now - e.time <= lookbackSec)
    .sort((a, b) => {
      const r = rank(b.type) - rank(a.type);
      if (r !== 0) return r;
      const size = (b.size ?? 0) - (a.size ?? 0);
      if (size !== 0) return size;
      return b.time - a.time;
    });

  const byMinute = new Map<number, OrderFlowEvent>();
  for (const e of recent) {
    const m = Math.floor(e.time / 60) * 60;
    const cur = byMinute.get(m);
    if (!cur || rank(e.type) > rank(cur.type) || (e.size ?? 0) > (cur.size ?? 0)) {
      byMinute.set(m, e);
    }
  }

  return Array.from(byMinute.values())
    .sort((a, b) => b.time - a.time)
    .slice(0, max);
}
