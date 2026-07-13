import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toAccountRecord } from "@/lib/account-utils";
import { ensureAccountsReady } from "@/lib/accounts";
import type { AccountInput } from "@/lib/types";

export async function GET() {
  await ensureAccountsReady();

  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { trades: true } },
      trades: { select: { pnlDollars: true } },
    },
  });

  return NextResponse.json(accounts.map(toAccountRecord));
}

export async function POST(request: Request) {
  const body = (await request.json()) as AccountInput;

  const account = await prisma.account.create({
    data: {
      name: body.name,
      firm: body.firm,
      type: body.type,
      status: body.status,
      size: body.size ?? null,
      notes: body.notes ?? null,
      color: body.color ?? "#34d399",
      startingBalance: body.startingBalance ?? null,
      currentBalance: body.currentBalance ?? body.startingBalance ?? null,
      profitTarget: body.profitTarget ?? null,
      maxDrawdown: body.maxDrawdown ?? null,
      dailyLossLimit: body.dailyLossLimit ?? null,
    },
    include: {
      _count: { select: { trades: true } },
      trades: { select: { pnlDollars: true } },
    },
  });

  return NextResponse.json(toAccountRecord(account), { status: 201 });
}
