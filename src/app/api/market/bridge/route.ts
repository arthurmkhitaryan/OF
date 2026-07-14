import { NextResponse } from "next/server";

/** Health check for optional local Rithmic bridge */
export async function GET() {
  const base = process.env.RITHMIC_BRIDGE_URL ?? "http://127.0.0.1:7788";
  try {
    const res = await fetch(`${base}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    const data = await res.json();
    return NextResponse.json({
      bridgeUrl: base,
      reachable: res.ok,
      ...data,
    });
  } catch (err) {
    return NextResponse.json({
      bridgeUrl: base,
      reachable: false,
      status: "offline",
      message: err instanceof Error ? err.message : "unreachable",
    });
  }
}
