import { Suspense } from "react";
import { StatCard } from "@/components/StatCard";
import { DailyPnlChart } from "@/components/DailyPnlChart";
import { AccountFilter } from "@/components/AccountFilter";
import { getStats } from "@/lib/stats";
import { formatPnl, formatR } from "@/lib/trade-utils";
import { LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { toAccountRecord } from "@/lib/account-utils";
import { ensureAccountsReady } from "@/lib/accounts";

type Props = { searchParams: Promise<{ account?: string }> };

function BreakdownTable({
  title,
  data,
  labelKey,
}: {
  title: string;
  data: Record<string, { trades: number; pnl: number; winRate: number; name?: string; firm?: string }>;
  labelKey?: (key: string, row: { name?: string; firm?: string }) => string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="mb-4 text-sm font-semibold text-zinc-300">{title}</h2>
      {Object.keys(data).length === 0 ? (
        <p className="text-sm text-zinc-500">Нет данных</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="pb-2">Категория</th>
              <th className="pb-2">Сделок</th>
              <th className="pb-2">Win Rate</th>
              <th className="pb-2 text-right">P&L</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data).map(([key, row]) => (
              <tr key={key} className="border-t border-zinc-800/60">
                <td className="py-2 text-zinc-300">
                  {labelKey ? labelKey(key, row) : (LABELS[key] ?? key)}
                </td>
                <td className="py-2 text-zinc-400">{row.trades}</td>
                <td className="py-2 text-zinc-400">{row.winRate}%</td>
                <td
                  className={`py-2 text-right tabular-nums ${
                    row.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {formatPnl(row.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default async function StatisticsPage({ searchParams }: Props) {
  await ensureAccountsReady();
  const { account } = await searchParams;
  const accountId = account ?? "all";

  const [stats, accountsRaw] = await Promise.all([
    getStats(accountId),
    prisma.account.findMany({
      include: { _count: { select: { trades: true } }, trades: { select: { pnlDollars: true } } },
    }),
  ]);

  const accounts = accountsRaw.map(toAccountRecord);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Статистика</h1>
        <p className="mt-1 text-sm text-zinc-500">По аккаунту или суммарно</p>
      </div>

      <Suspense fallback={null}>
        <AccountFilter accounts={accounts} />
      </Suspense>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Всего сделок" value={String(stats.totalTrades)} />
        <StatCard label="Win Rate" value={`${stats.winRate}%`} />
        <StatCard
          label="Profit Factor"
          value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
        />
        <StatCard label="Средний выигрыш" value={formatPnl(stats.avgWin)} positive />
        <StatCard label="Средний проигрыш" value={formatPnl(-stats.avgLoss)} positive={false} />
        <StatCard label="Expectancy" value={formatPnl(stats.expectancy)} />
        <StatCard label="Лучшая сделка" value={formatPnl(stats.bestTrade)} positive />
        <StatCard label="Худшая сделка" value={formatPnl(stats.worstTrade)} positive={false} />
        <StatCard label="Средний R" value={formatR(stats.avgR)} />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">P&L по дням</h2>
        <DailyPnlChart data={stats.dailyPnl} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {accountId === "all" && (
          <BreakdownTable
            title="По аккаунтам"
            data={stats.byAccount}
            labelKey={(_key, row) => `${row.name} (${row.firm})`}
          />
        )}
        <BreakdownTable title="По модели (Range vs Trend)" data={stats.byModel} />
        <BreakdownTable title="По инструменту (NQ vs ES)" data={stats.byInstrument} />
        <BreakdownTable title="По типу входа" data={stats.byEntryType} />
        <BreakdownTable title="По качеству сетапа" data={stats.byQuality} />
      </div>
    </div>
  );
}
