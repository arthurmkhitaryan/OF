import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as {
    balance: number;
    dayPnl?: number | null;
    notes?: string | null;
    date?: string;
  };

  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const date = body.date ? new Date(body.date) : new Date();
  date.setHours(12, 0, 0, 0);

  const snapshot = await prisma.accountSnapshot.upsert({
    where: { accountId_date: { accountId: id, date } },
    create: {
      accountId: id,
      date,
      balance: body.balance,
      dayPnl: body.dayPnl ?? null,
      notes: body.notes ?? null,
    },
    update: {
      balance: body.balance,
      dayPnl: body.dayPnl ?? null,
      notes: body.notes ?? null,
    },
  });

  await prisma.account.update({
    where: { id },
    data: { currentBalance: body.balance },
  });

  return NextResponse.json({
    id: snapshot.id,
    balance: snapshot.balance,
    date: snapshot.date.toISOString(),
  });
}
