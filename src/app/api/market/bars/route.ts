import { NextResponse } from "next/server";
import { fetchYahooBars } from "@/lib/market-bars";
import { computeVolumeProfile } from "@/lib/volume-profile";
import { buildLiveSignal } from "@/lib/signal-engine";
import { getGexForDate } from "@/lib/gex-queries";
import { resolveOrderFlow } from "@/lib/orderflow-engine";
import type { GexLevelsLite, LiveInstrument } from "@/lib/market-types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "NQ").toUpperCase();
  if (symbol !== "NQ" && symbol !== "ES") {
    return NextResponse.json({ error: "symbol must be NQ or ES" }, { status: 400 });
  }

  const instrument = symbol as LiveInstrument;
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

  return NextResponse.json({
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
    bridge: {
      configured: true,
      connected: of.source === "bridge",
      docs: "/docs/rithmic-setup.md",
    },
  });
}
