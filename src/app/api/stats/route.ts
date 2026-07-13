import { NextResponse } from "next/server";
import { getStats } from "@/lib/stats";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const stats = await getStats(accountId);
  return NextResponse.json(stats);
}
