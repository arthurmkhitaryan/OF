import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toAccountRecord } from "@/lib/account-utils";
import type { AccountInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      _count: { select: { trades: true } },
      trades: { select: { pnlDollars: true } },
    },
  });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toAccountRecord(account));
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as AccountInput;

  const account = await prisma.account.update({
    where: { id },
    data: {
      name: body.name,
      firm: body.firm,
      type: body.type,
      status: body.status,
      size: body.size ?? null,
      notes: body.notes ?? null,
      color: body.color ?? "#34d399",
      startingBalance: body.startingBalance ?? null,
      currentBalance: body.currentBalance ?? null,
      profitTarget: body.profitTarget ?? null,
      maxDrawdown: body.maxDrawdown ?? null,
      dailyLossLimit: body.dailyLossLimit ?? null,
    },
    include: {
      _count: { select: { trades: true } },
      trades: { select: { pnlDollars: true } },
    },
  });

  return NextResponse.json(toAccountRecord(account));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const tradeCount = await prisma.trade.count({ where: { accountId: id } });
  if (tradeCount > 0) {
    return NextResponse.json(
      { error: "Нельзя удалить аккаунт со сделками" },
      { status: 400 }
    );
  }
  await prisma.account.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
