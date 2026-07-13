import { NextResponse } from "next/server";
import { getMonthlyReport } from "@/lib/reports";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const accountId = searchParams.get("accountId");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 });
  }

  const [year, m] = month.split("-").map(Number);
  const report = await getMonthlyReport(year, m, accountId);
  return NextResponse.json(report);
}
