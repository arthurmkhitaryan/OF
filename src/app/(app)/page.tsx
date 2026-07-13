import Link from "next/link";
import { Suspense } from "react";
import { format } from "date-fns";
import { StatCard } from "@/components/StatCard";
import { TradeList } from "@/components/TradeList";
import { DailyPnlChart } from "@/components/DailyPnlChart";
import { AccountFilter } from "@/components/AccountFilter";
import { GexTodayWidget } from "@/components/GexTodayWidget";
import { getStats } from "@/lib/stats";
import { getGexForDate } from "@/lib/gex-queries";
import { formatPnl, formatR } from "@/lib/trade-utils";
import { LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { toAccountRecord } from "@/lib/account-utils";
import { ensureAccountsReady } from "@/lib/accounts";

type Props = { searchParams: Promise<{ account?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  await ensureAccountsReady();
  const { account } = await searchParams;
  const accountId = account ?? "all";
  const today = format(new Date(), "yyyy-MM-dd");

  const [stats, accountsRaw, gex] = await Promise.all([
    getStats(accountId),
    prisma.account.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { trades: true } }, trades: { select: { pnlDollars: true } } },
    }),
    getGexForDate(today),
  ]);

  const accounts = accountsRaw.map(toAccountRecord);
  const filterLabel =
    accountId === "all"
      ? "Все счета"
      : accounts.find((a) => a.id === accountId)?.name ?? "Счёт";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Дашборд</h1>
          <p className="mt-1 text-sm text-zinc-500">{filterLabel}</p>
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

      <GexTodayWidget date={gex.date} NQ={gex.NQ} ES={gex.ES} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Общий P&L" value={formatPnl(stats.totalPnl)} positive={stats.totalPnl >= 0} />
        <StatCard label="Win Rate" value={`${stats.winRate}%`} sub={`${stats.totalTrades} сделок`} />
        <StatCard
          label="Profit Factor"
          value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
        />
        <StatCard label="Expectancy" value={formatPnl(stats.expectancy)} sub={`Avg R: ${formatR(stats.avgR)}`} />
      </div>

      {accountId === "all" && Object.keys(stats.byAccount).length > 1 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">По аккаунтам</h2>
          <div className="space-y-3">
            {Object.entries(stats.byAccount).map(([id, data]) => (
              <div key={id} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">
                  {data.name} <span className="text-zinc-600">({data.firm})</span>
                </span>
                <div className="flex gap-4 tabular-nums">
                  <span className="text-zinc-500">{data.trades} сд.</span>
                  <span className="text-zinc-500">{data.winRate}% WR</span>
                  <span className={data.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {formatPnl(data.pnl)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">P&L по дням</h2>
          <DailyPnlChart data={stats.dailyPnl} />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="mb-4 text-sm font-semibold text-zinc-300">По моделям</h2>
            <div className="space-y-3">
              {Object.entries(stats.byModel).map(([key, data]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{LABELS[key] ?? key}</span>
                  <div className="flex gap-4 tabular-nums">
                    <span className="text-zinc-500">{data.trades} сд.</span>
                    <span className={data.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {formatPnl(data.pnl)}
                    </span>
                  </div>
                </div>
              ))}
              {Object.keys(stats.byModel).length === 0 && (
                <p className="text-sm text-zinc-500">Нет данных</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Последние сделки</h2>
          <Link href="/trades" className="text-sm text-emerald-400 hover:underline">
            Все сделки →
          </Link>
        </div>
        <TradeList trades={stats.recentTrades} showAccount={accountId === "all"} />
      </div>
    </div>
  );
}
