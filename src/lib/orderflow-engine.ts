import type {
  DeltaBar,
  LiveInstrument,
  MarketBar,
  OrderFlowEvent,
  OrderFlowSnapshot,
  TickPrint,
} from "./market-types";

const BIG_TRADE: Record<LiveInstrument, number> = { NQ: 40, ES: 100 };

/**
 * Classify tape prints → Big trade / Absorption / Trapped + delta bars.
 * Works on real bridge prints OR reconstructed demo tape.
 */
export function analyzeOrderFlow(
  instrument: LiveInstrument,
  prints: TickPrint[],
  source: "bridge" | "demo" | "none"
): OrderFlowSnapshot {
  const sorted = [...prints].sort((a, b) => a.time - b.time);
  const big = detectBigTrades(instrument, sorted)
    .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
    .slice(0, 20);
  const abs = detectAbsorption(instrument, sorted).slice(0, 8);
  const trap = detectTrapped(instrument, sorted)
    .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
    .slice(0, 5);

  const events: OrderFlowEvent[] = [...big, ...abs, ...trap].sort(
    (a, b) => b.time - a.time
  );

  const delta = buildDeltaBars(sorted);
  const cumDelta = sorted.reduce(
    (acc, p) => acc + (p.side === "BUY" ? p.size : -p.size),
    0
  );

  return {
    source,
    prints: sorted.slice(-500),
    events: events.slice(0, 40),
    delta: delta.slice(-90),
    cumDelta,
  };
}

export function detectBigTrades(
  instrument: LiveInstrument,
  prints: TickPrint[]
): OrderFlowEvent[] {
  const min = BIG_TRADE[instrument];
  return prints
    .filter((p) => p.size >= min)
    .map((p) => ({
      type: "BIG_TRADE" as const,
      instrument,
      price: p.price,
      size: p.size,
      side: p.side,
      time: Math.floor(p.time),
      note: `${p.size} lots @ ${p.price}`,
    }));
}

/**
 * Absorption: large same-side volume at a tight price band while price
 * fails to continue (next window moves against or flat).
 */
export function detectAbsorption(
  instrument: LiveInstrument,
  prints: TickPrint[]
): OrderFlowEvent[] {
  if (prints.length < 40) return [];
  const events: OrderFlowEvent[] = [];
  const window = 18;
  const big = BIG_TRADE[instrument] * 0.45;

  for (let i = window; i < prints.length - 8; i += 4) {
    const slice = prints.slice(i - window, i);
    const buy = slice.filter((p) => p.side === "BUY").reduce((s, p) => s + p.size, 0);
    const sell = slice.filter((p) => p.side === "SELL").reduce((s, p) => s + p.size, 0);
    const side: "BUY" | "SELL" = buy >= sell ? "BUY" : "SELL";
    const vol = Math.max(buy, sell);
    if (vol < big * 2.2) continue;

    const prices = slice.map((p) => p.price);
    const mid = prices.reduce((a, b) => a + b, 0) / prices.length;
    const band = Math.max(...prices) - Math.min(...prices);
    const tick = instrument === "NQ" ? 0.25 : 0.25;
    if (band > tick * 12) continue; // must be at a level, not a runaway trend

    const after = prints.slice(i, i + 10);
    const afterMove = after[after.length - 1].price - mid;
    // absorbed: aggressive buy but price flat/down, or sell but price flat/up
    const absorbed =
      (side === "BUY" && afterMove <= tick * 2) ||
      (side === "SELL" && afterMove >= -tick * 2);
    if (!absorbed) continue;

    events.push({
      type: "ABSORPTION",
      instrument,
      price: roundPrice(mid, instrument),
      size: vol,
      side,
      time: Math.floor(slice[slice.length - 1].time),
      note: `${side} abs ~${vol} lots, price held`,
    });
  }

  return dedupeNear(events, 120).slice(0, 8);
}

/**
 * Trapped: liquidity sweep (aggressive run) then reclaim back through the
 * extreme within a short window.
 */
export function detectTrapped(
  instrument: LiveInstrument,
  prints: TickPrint[]
): OrderFlowEvent[] {
  if (prints.length < 50) return [];
  const events: OrderFlowEvent[] = [];
  const tick = instrument === "NQ" ? 0.25 : 0.25;

  for (let i = 30; i < prints.length - 12; i += 12) {
    const pre = prints.slice(i - 30, i);
    const post = prints.slice(i, i + 12);
    const preHigh = Math.max(...pre.map((p) => p.price));
    const preLow = Math.min(...pre.map((p) => p.price));
    const sweepHigh = Math.max(...post.slice(0, 6).map((p) => p.price));
    const sweepLow = Math.min(...post.slice(0, 6).map((p) => p.price));
    const end = post[post.length - 1].price;

    const lookAbove = sweepHigh > preHigh + tick * 4 && end < preHigh - tick * 2;
    const lookBelow = sweepLow < preLow - tick * 4 && end > preLow + tick * 2;

    if (!lookAbove && !lookBelow) continue;

    const side: "BUY" | "SELL" = lookAbove ? "BUY" : "SELL";
    const price = lookAbove ? sweepHigh : sweepLow;
    const size = post.slice(0, 6).reduce((s, p) => s + p.size, 0);
    if (size < BIG_TRADE[instrument] * 0.8) continue;

    events.push({
      type: "TRAPPED",
      instrument,
      price: roundPrice(price, instrument),
      size,
      side,
      time: Math.floor(post[5]?.time ?? post[0].time),
      note: lookAbove ? "Look above & fail — longs trapped" : "Look below & fail — shorts trapped",
    });
  }

  return dedupeNear(events, 90);
}

export function buildDeltaBars(prints: TickPrint[]): DeltaBar[] {
  const map = new Map<number, DeltaBar>();
  for (const p of prints) {
    const t = Math.floor(p.time / 60) * 60;
    const cur = map.get(t) ?? { time: t, delta: 0, buyVol: 0, sellVol: 0, close: p.price };
    if (p.side === "BUY") {
      cur.buyVol += p.size;
      cur.delta += p.size;
    } else {
      cur.sellVol += p.size;
      cur.delta -= p.size;
    }
    cur.close = p.price;
    map.set(t, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

export async function fetchBridgeOrderFlow(
  instrument: LiveInstrument
): Promise<OrderFlowEvent[]> {
  const snap = await fetchBridgeTape(instrument);
  return snap?.events ?? [];
}

/** Prefer real bridge tape; null if stub/offline */
export async function fetchBridgeTape(
  instrument: LiveInstrument
): Promise<OrderFlowSnapshot | null> {
  const base = process.env.RITHMIC_BRIDGE_URL ?? "http://127.0.0.1:7788";
  try {
    const res = await fetch(`${base}/orderflow?symbol=${instrument}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      events?: OrderFlowEvent[];
      prints?: TickPrint[];
      delta?: DeltaBar[];
      cumDelta?: number;
      source?: string;
    };
    // Bridge connected → source bridge even before first ticks arrive
    if (data.source === "bridge" || data.prints || data.events) {
      return analyzeOrderFlow(instrument, data.prints ?? [], "bridge");
    }
    return null;
  } catch {
    return null;
  }
}

export function emptyOrderFlow(): OrderFlowSnapshot {
  return {
    source: "none",
    prints: [],
    events: [],
    delta: [],
    cumDelta: 0,
  };
}

/**
 * Resolve OF: bridge first. Demo only if ALLOW_DEMO_OF=1.
 */
export async function resolveOrderFlow(
  instrument: LiveInstrument,
  bars: MarketBar[]
): Promise<OrderFlowSnapshot> {
  const bridge = await fetchBridgeTape(instrument);
  if (bridge) return bridge;
  if (process.env.ALLOW_DEMO_OF === "1") {
    return synthesizeTapeFromBars(instrument, bars);
  }
  return emptyOrderFlow();
}

/**
 * Build demo tape from 1m bars — OFF by default (ALLOW_DEMO_OF=1 to enable).
 */
export function synthesizeTapeFromBars(
  instrument: LiveInstrument,
  bars: MarketBar[]
): OrderFlowSnapshot {
  const prints = synthesizePrints(instrument, bars);
  return analyzeOrderFlow(instrument, prints, "demo");
}

export function synthesizePrints(
  instrument: LiveInstrument,
  bars: MarketBar[]
): TickPrint[] {
  const recent = bars.slice(-90);
  const prints: TickPrint[] = [];
  const tick = instrument === "NQ" ? 0.25 : 0.25;
  const avgLot = instrument === "NQ" ? 4 : 8;
  const bigChance = 0.035;
  const bigMin = BIG_TRADE[instrument];

  for (const bar of recent) {
    const path = barPath(bar, tick);
    const n = Math.min(100, Math.max(8, Math.round(bar.volume / (avgLot * 6))));
    const bullish = bar.close >= bar.open;

    for (let i = 0; i < n; i++) {
      const t = bar.time + (i / n) * 59;
      const price = path[Math.min(path.length - 1, Math.floor((i / n) * path.length))];
      // aggressor bias by bar direction + noise
      const bias = bullish ? 0.62 : 0.38;
      const side: "BUY" | "SELL" = Math.random() < bias ? "BUY" : "SELL";
      let size = Math.max(1, Math.round(avgLot * (0.4 + Math.random() * 1.6)));
      if (Math.random() < bigChance) {
        size = bigMin + Math.round(Math.random() * bigMin);
      }
      // cluster occasionally at extremes for absorption-like patterns
      const cluster =
        i > n * 0.7 && Math.random() < 0.15
          ? bullish
            ? bar.high
            : bar.low
          : price;
      prints.push({
        time: t,
        price: roundPrice(cluster, instrument),
        size,
        side,
      });
    }
  }

  return prints;
}

/** One live print for SSE between bar refreshes */
export function nextDemoPrint(
  instrument: LiveInstrument,
  lastPrice: number,
  nowSec = Date.now() / 1000
): TickPrint {
  const tick = 0.25;
  const jump = Math.round((Math.random() - 0.5) * 6) * tick;
  const price = roundPrice(lastPrice + jump, instrument);
  const side: "BUY" | "SELL" = jump >= 0 ? "BUY" : "SELL";
  const big = Math.random() < 0.04;
  const size = big
    ? BIG_TRADE[instrument] + Math.round(Math.random() * 40)
    : 1 + Math.round(Math.random() * (instrument === "NQ" ? 12 : 25));
  return { time: nowSec, price, size, side };
}

function barPath(bar: MarketBar, tick: number): number[] {
  const pts: number[] = [bar.open];
  const upFirst = bar.close >= bar.open;
  if (upFirst) {
    pts.push(bar.low, bar.high, bar.close);
  } else {
    pts.push(bar.high, bar.low, bar.close);
  }
  const out: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const steps = Math.max(1, Math.round(Math.abs(b - a) / tick));
    for (let s = 0; s <= steps; s++) {
      out.push(a + ((b - a) * s) / steps);
    }
  }
  return out;
}

function roundPrice(p: number, instrument: LiveInstrument) {
  const tick = instrument === "NQ" ? 0.25 : 0.25;
  return Math.round(p / tick) * tick;
}

function dedupeNear(events: OrderFlowEvent[], sec: number): OrderFlowEvent[] {
  const out: OrderFlowEvent[] = [];
  for (const e of events) {
    const hit = out.find(
      (o) =>
        o.type === e.type &&
        Math.abs(o.time - e.time) < sec &&
        Math.abs(o.price - e.price) < 8
    );
    if (!hit) out.push(e);
  }
  return out;
}
