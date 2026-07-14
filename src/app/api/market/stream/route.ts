import { NextRequest } from "next/server";
import { fetchYahooBars } from "@/lib/market-bars";
import { computeVolumeProfile } from "@/lib/volume-profile";
import { buildLiveSignal } from "@/lib/signal-engine";
import { getGexForDate } from "@/lib/gex-queries";
import {
  analyzeOrderFlow,
  resolveOrderFlow,
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

const TICK_MS = 250;
const FULL_REFRESH_MS = 60_000;
const HEAVY_EVERY = 4;
const BRIDGE_POLL_EVERY = 2;

function encode(data: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
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
  const of = await resolveOrderFlow(instrument, bars);
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

/** Only used when ALLOW_DEMO_OF=1 */
function tickBars(bars: MarketBar[], print: TickPrint): MarketBar[] {
  if (!bars.length) return bars;
  const next = bars.map((b) => ({ ...b }));
  const last = next[next.length - 1];
  const now = Math.floor(print.time);
  const close = print.price;
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
      high: Math.max(last.high, close),
      low: Math.min(last.low, close),
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
          let of = snap.of as OrderFlowSnapshot;

          if (of.source === "bridge" || of.source === "none") {
            if (tickN % BRIDGE_POLL_EVERY === 0) {
              of = await resolveOrderFlow(instrument, snap.bars);
              const heavy = tickN % (BRIDGE_POLL_EVERY * HEAVY_EVERY) === 0;
              if (heavy) {
                const binSize = instrument === "NQ" ? 5 : 2.5;
                const profile = computeVolumeProfile(snap.bars, binSize);
                const signal = buildLiveSignal(snap.bars, profile, snap.gex, of);
                snap = {
                  ...snap,
                  type: "tick",
                  profile,
                  signal,
                  orderflow: of.events,
                  of,
                  bridge: { connected: of.source === "bridge" },
                  updatedAt: new Date().toISOString(),
                };
              } else {
                snap = {
                  ...snap,
                  type: "tick",
                  orderflow: of.events,
                  of,
                  bridge: { connected: of.source === "bridge" },
                  updatedAt: new Date().toISOString(),
                };
              }
            }
          } else if (of.source === "demo" && process.env.ALLOW_DEMO_OF === "1") {
            const { nextDemoPrint } = await import("@/lib/orderflow-engine");
            const lastPrice = snap.bars[snap.bars.length - 1]?.close ?? 0;
            const print = nextDemoPrint(instrument, lastPrice);
            const prints = [...of.prints, print].slice(-200);
            const bars = tickBars(snap.bars, print);
            if (tickN % HEAVY_EVERY === 0) {
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
