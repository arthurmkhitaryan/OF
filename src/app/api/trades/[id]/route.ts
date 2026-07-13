import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toTradeRecord } from "@/lib/trade-utils";
import type { TradeInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const trade = await prisma.trade.findUnique({
    where: { id },
    include: { account: { select: { name: true, firm: true } } },
  });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toTradeRecord(trade));
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as TradeInput;

  const trade = await prisma.trade.update({
    where: { id },
    data: {
      accountId: body.accountId,
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

  return NextResponse.json(toTradeRecord(trade));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await prisma.trade.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
