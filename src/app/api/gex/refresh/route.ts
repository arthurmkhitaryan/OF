import { NextResponse } from "next/server";
import { format } from "date-fns";
import { refreshGexFromCboe } from "@/lib/gex-queries";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { date?: string };
    const date = body.date ?? format(new Date(), "yyyy-MM-dd");
    const result = await refreshGexFromCboe(date);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refresh failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  try {
    const result = await refreshGexFromCboe();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refresh failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
