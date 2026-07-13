import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toTradeRecord } from "@/lib/trade-utils";
import { ensureAccountsReady, getDefaultAccountId } from "@/lib/accounts";
import type { TradeInput } from "@/lib/types";

export async function GET(request: Request) {
  await ensureAccountsReady();
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  const trades = await prisma.trade.findMany({
    where: accountId && accountId !== "all" ? { accountId } : undefined,
    include: { account: { select: { name: true, firm: true } } },
    orderBy: { tradeDate: "desc" },
  });

  return NextResponse.json(trades.map(toTradeRecord));
}

export async function POST(request: Request) {
  const body = (await request.json()) as TradeInput;
  const accountId = body.accountId || (await getDefaultAccountId());

  const trade = await prisma.trade.create({
    data: {
      accountId,
      tradeDate: new Date(body.tradeDate),
      instrument: body.instrument,
      model: body.model,
      direction: body.direction,
      entryType: body.entryType,
      setupQuality: body.setupQuality,
      session: body.session,
      confirmations: JSON.stringify(body.confirmations ?? []),
      mistakes: JSON.stringify(body.mistakes ?? []),
      entryPrice: body.entryPrice ?? null,
      exitPrice: body.exitPrice ?? null,
      stopPrice: body.stopPrice ?? null,
      targetPrice: body.targetPrice ?? null,
      contracts: body.contracts,
      pnlDollars: body.pnlDollars,
      pnlR: body.pnlR ?? null,
      notes: body.notes ?? null,
      screenshots: JSON.stringify(body.screenshots ?? []),
    },
    include: { account: { select: { name: true, firm: true } } },
  });

  return NextResponse.json(toTradeRecord(trade), { status: 201 });
}
