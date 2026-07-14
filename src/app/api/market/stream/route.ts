import { NextRequest } from "next/server";
import { fetchYahooBars } from "@/lib/market-bars";
import { computeVolumeProfile } from "@/lib/volume-profile";
import { buildLiveSignal } from "@/lib/signal-engine";
import { getGexForDate } from "@/lib/gex-queries";
import {
  analyzeOrderFlow,
  fetchBridgeTape,
  nextDemoPrint,
  synthesizeTapeFromBars,
} from "@/lib/orderflow-engine";
import type {
  GexLevelsLite,
  LiveInstrument,
  MarketBar,
  OrderFlowSnapshot,
  TickPrint,
} from "@/lib/market-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Fastest practical SSE cadence for demo/live UI */
const TICK_MS = 200;
const FULL_REFRESH_MS = 60_000;
const HEAVY_EVERY = 5; // profile/signal/OF less often than price ticks

function encode(data: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

async function buildOf(
  instrument: LiveInstrument,
  bars: MarketBar[]
): Promise<OrderFlowSnapshot> {
  const bridge = await fetchBridgeTape(instrument);
  if (bridge && (bridge.prints.length > 0 || bridge.events.length > 0)) {
    return bridge;
  }
  return synthesizeTapeFromBars(instrument, bars);
}

async function snapshot(instrument: LiveInstrument) {
  const binSize = instrument === "NQ" ? 5 : 2.5;
  const [{ bars, source, symbol: feedSymbol, error }, gexDay] = await Promise.all([
    fetchYahooBars(instrument),
    getGexForDate(),
  ]);

  const profile = computeVolumeProfile(bars, binSize);
  const gexSnap = instrument === "NQ" ? gexDay.NQ : gexDay.ES;
  const gex: GexLevelsLite | null = gexSnap
    ? {
        spot: gexSnap.spot,
        zeroGamma: gexSnap.zeroGamma,
        callWall: gexSnap.callWall,
        putWall: gexSnap.putWall,
        hvl: gexSnap.hvl,
      }
    : null;
  const of = await buildOf(instrument, bars);
  const signal = buildLiveSignal(bars, profile, gex, of);

  return {
    type: "snapshot" as "snapshot" | "tick",
    instrument,
    feedSymbol,
    source,
    error: error ?? null,
    updatedAt: new Date().toISOString(),
    bars,
    profile,
    gex,
    signal,
    orderflow: of.events,
    of,
    bridge: { connected: of.source === "bridge" },
  };
}

function tickBars(bars: MarketBar[], print: TickPrint): MarketBar[] {
  if (!bars.length) return bars;
  const next = bars.map((b) => ({ ...b }));
  const last = next[next.length - 1];
  const now = Math.floor(print.time);
  const close = print.price;
  const high = Math.max(last.high, close);
  const low = Math.min(last.low, close);

  if (now - last.time >= 55) {
    next.push({
      time: now,
      open: last.close,
      high: Math.max(last.close, close),
      low: Math.min(last.close, close),
      close,
      volume: print.size,
    });
    if (next.length > 500) next.shift();
  } else {
    next[next.length - 1] = {
      ...last,
      high,
      low,
      close,
      volume: last.volume + print.size,
    };
  }
  return next;
}

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get("symbol") ?? "NQ").toUpperCase();
  if (symbol !== "NQ" && symbol !== "ES") {
    return new Response(JSON.stringify({ error: "symbol must be NQ or ES" }), {
      status: 400,
    });
  }
  const instrument = symbol as LiveInstrument;

  let cancelled = false;
  request.signal.addEventListener("abort", () => {
    cancelled = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let snap = await snapshot(instrument);
        let tickN = 0;
        let snapshotAt = Date.now();
        controller.enqueue(encode(snap));

        while (!cancelled) {
          await new Promise((r) => setTimeout(r, TICK_MS));
          if (cancelled) break;

          if (Date.now() - snapshotAt > FULL_REFRESH_MS) {
            snap = await snapshot(instrument);
            snapshotAt = Date.now();
            tickN = 0;
            controller.enqueue(encode(snap));
            continue;
          }

          tickN += 1;
          const lastPrice = snap.bars[snap.bars.length - 1]?.close ?? 0;
          let of = snap.of as OrderFlowSnapshot;

          if (of.source === "demo") {
            const print = nextDemoPrint(instrument, lastPrice);
            const prints = [...of.prints, print].slice(-200);
            const bars = tickBars(snap.bars, print);
            const heavy = tickN % HEAVY_EVERY === 0;

            if (heavy) {
              of = analyzeOrderFlow(instrument, prints, "demo");
              const binSize = instrument === "NQ" ? 5 : 2.5;
              const profile = computeVolumeProfile(bars, binSize);
              const signal = buildLiveSignal(bars, profile, snap.gex, of);
              snap = {
                ...snap,
                type: "tick",
                bars,
                profile,
                signal,
                orderflow: of.events,
                of,
                updatedAt: new Date().toISOString(),
              };
            } else {
              // Fast path: price + append print only (skip full OF recompute)
              of = {
                ...of,
                prints,
                cumDelta:
                  of.cumDelta + (print.side === "BUY" ? print.size : -print.size),
              };
              snap = {
                ...snap,
                type: "tick",
                bars,
                of,
                orderflow: of.events,
                updatedAt: new Date().toISOString(),
              };
            }
          } else if (tickN % 10 === 0) {
            of = await buildOf(instrument, snap.bars);
            snap = {
              ...snap,
              type: "tick",
              orderflow: of.events,
              of,
              updatedAt: new Date().toISOString(),
            };
          }

          controller.enqueue(encode(snap));
        }
      } catch (err) {
        controller.enqueue(
          encode({
            type: "error",
            message: err instanceof Error ? err.message : "stream error",
          })
        );
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
