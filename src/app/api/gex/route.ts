import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  GEX_INSTRUMENTS,
  parseGexDate,
  toGexRecord,
  type GexInstrument,
  type GexSnapshotInput,
} from "@/lib/gex";
import { format } from "date-fns";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");
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
    snapshots: rows.map(toGexRecord),
    NQ: byInstrument.NQ,
    ES: byInstrument.ES,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as GexSnapshotInput | GexSnapshotInput[];
  const items = Array.isArray(body) ? body : [body];

  const results = [];

  for (const item of items) {
    if (!item.date || !item.instrument) {
      return NextResponse.json(
        { error: "date and instrument required" },
        { status: 400 }
      );
    }
    if (!GEX_INSTRUMENTS.includes(item.instrument as GexInstrument)) {
      return NextResponse.json(
        { error: "instrument must be NQ or ES" },
        { status: 400 }
      );
    }

    const date = parseGexDate(item.date);
    const data = {
      spot: item.spot ?? null,
      zeroGamma: item.zeroGamma ?? null,
      callWall: item.callWall ?? null,
      putWall: item.putWall ?? null,
      hvl: item.hvl ?? null,
      source: item.source ?? null,
      notes: item.notes ?? null,
    };

    const row = await prisma.gexSnapshot.upsert({
      where: {
        date_instrument: { date, instrument: item.instrument },
      },
      create: {
        date,
        instrument: item.instrument,
        ...data,
      },
      update: data,
    });

    results.push(toGexRecord(row));
  }

  return NextResponse.json(
    Array.isArray(body) ? results : results[0],
    { status: 201 }
  );
}
