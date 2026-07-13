import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { parseGexDate, toGexRecord } from "@/lib/gex";

export async function GET() {
  const dateStr = format(new Date(), "yyyy-MM-dd");
  const date = parseGexDate(dateStr);

  const rows = await prisma.gexSnapshot.findMany({
    where: { date },
    orderBy: { instrument: "asc" },
  });

  const byInstrument: Record<string, ReturnType<typeof toGexRecord> | null> = {
    NQ: null,
    ES: null,
  };
  for (const row of rows) {
    byInstrument[row.instrument] = toGexRecord(row);
  }

  return NextResponse.json({
    date: dateStr,
    NQ: byInstrument.NQ,
    ES: byInstrument.ES,
    snapshots: rows.map(toGexRecord),
  });
}
