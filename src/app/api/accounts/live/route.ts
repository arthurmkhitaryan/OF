import { NextResponse } from "next/server";
import { getAccountsLiveStatus } from "@/lib/reports";

export async function GET() {
  const accounts = await getAccountsLiveStatus();
  return NextResponse.json(accounts);
}
