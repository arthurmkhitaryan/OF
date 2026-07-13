import Link from "next/link";
import { Suspense } from "react";
import { TradeList } from "@/components/TradeList";
import { AccountFilter } from "@/components/AccountFilter";
import { prisma } from "@/lib/prisma";
import { toTradeRecord } from "@/lib/trade-utils";
import { toAccountRecord } from "@/lib/account-utils";
import { ensureAccountsReady } from "@/lib/accounts";

type Props = { searchParams: Promise<{ account?: string }> };

export default async function TradesPage({ searchParams }: Props) {
  await ensureAccountsReady();
  const { account } = await searchParams;
  const accountId = account ?? "all";

  const [trades, accountsRaw] = await Promise.all([
    prisma.trade.findMany({
      where: accountId !== "all" ? { accountId } : undefined,
      include: { account: { select: { name: true, firm: true } } },
      orderBy: { tradeDate: "desc" },
    }),
    prisma.account.findMany({
      include: { _count: { select: { trades: true } }, trades: { select: { pnlDollars: true } } },
    }),
  ]);

  const accounts = accountsRaw.map(toAccountRecord);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Журнал сделок</h1>
          <p className="mt-1 text-sm text-zinc-500">{trades.length} записей</p>
        </div>
        <Link
          href="/trades/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          + Новая сделка
        </Link>
      </div>

      <Suspense fallback={null}>
        <AccountFilter accounts={accounts} />
      </Suspense>

      <TradeList trades={trades.map(toTradeRecord)} showAccount={accountId === "all"} />
    </div>
  );
}
