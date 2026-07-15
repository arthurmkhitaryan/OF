import { NextRequest } from "next/server";
import { fetchMarketBars } from "@/lib/market-bars";
import { computeVolumeProfile } from "@/lib/volume-profile";
import { buildLiveSignal } from "@/lib/signal-engine";
import { getGexForDate } from "@/lib/gex-queries";
import { resolveOrderFlow } from "@/lib/orderflow-engine";
import type { GexLevelsLite, LiveInstrument } from "@/lib/market-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Full chart snapshot cadence. Live price/OF comes from bridge WebSocket (ms). */
const FULL_REFRESH_MS = 15_000;
const HEARTBEAT_MS = 5_000;

function encode(data: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

async function snapshot(instrument: LiveInstrument) {
  const binSize = instrument === "NQ" ? 5 : 2.5;
  const [{ bars, source, symbol: feedSymbol, error }, gexDay] = await Promise.all([
    fetchMarketBars(instrument),
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
    type: "snapshot" as const,
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
    bridge: { connected: of.source === "bridge" || source === "bridge" },
  };
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
        let snapshotAt = Date.now();
        let heartbeatAt = Date.now();
        controller.enqueue(encode(snap));

        while (!cancelled) {
          await new Promise((r) => setTimeout(r, 500));
          if (cancelled) break;

          const now = Date.now();
          if (now - snapshotAt >= FULL_REFRESH_MS) {
            snap = await snapshot(instrument);
            snapshotAt = now;
            heartbeatAt = now;
            controller.enqueue(encode(snap));
            continue;
          }

          // Keep SSE alive without flooding React with 4 full frames/sec
          if (now - heartbeatAt >= HEARTBEAT_MS) {
            heartbeatAt = now;
            controller.enqueue(
              encode({
                type: "heartbeat",
                instrument,
                bridge: snap.bridge,
                updatedAt: new Date().toISOString(),
              })
            );
          }
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
