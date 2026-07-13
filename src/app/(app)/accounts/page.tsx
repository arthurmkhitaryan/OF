import { getAccountsLiveStatus } from "@/lib/reports";
import { ensureAccountsReady } from "@/lib/accounts";
import { getStats } from "@/lib/stats";
import { formatPnl } from "@/lib/trade-utils";
import { AccountForm } from "@/components/AccountForm";
import { AccountLiveCard } from "@/components/AccountLiveCard";
import { cn } from "@/lib/cn";
import { Radio } from "lucide-react";

export default async function AccountsPage() {
  await ensureAccountsReady();

  const [liveAccounts, totalStats] = await Promise.all([
    getAccountsLiveStatus(),
    getStats("all"),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Аккаунты</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Отслеживание в реальном времени по журналу + синхронизация баланса с prop firm
        </p>
      </div>

      {/* Live status banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-900/40 bg-blue-950/20 p-4">
        <Radio size={18} className="mt-0.5 shrink-0 text-blue-400" />
        <div className="text-sm">
          <p className="font-medium text-blue-300">Как работает live-отслеживание</p>
          <p className="mt-1 text-zinc-400">
            P&L сегодня / неделя / месяц обновляется автоматически при добавлении сделок в журнал.
            Баланс и лимиты prop firm — обновляй кнопкой «Обновить баланс» после сессии из Lucid dashboard.
            Авто-синхронизация с брокером появится позже (Tradovate / NinjaTrader CSV).
          </p>
        </div>
      </div>

      {/* Total summary */}
      <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-5">
        <h2 className="text-sm font-semibold text-emerald-300">Суммарно по всем счетам</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-4">
          <Metric label="P&L (журнал)" value={formatPnl(totalStats.totalPnl)} positive={totalStats.totalPnl >= 0} />
          <Metric label="Сегодня" value={formatPnl(liveAccounts.reduce((s, a) => s + a.pnlToday, 0))} />
          <Metric label="Этот месяц" value={formatPnl(liveAccounts.reduce((s, a) => s + a.pnlThisMonth, 0))} />
          <Metric label="Сделок" value={String(totalStats.totalTrades)} />
        </div>
      </div>

      {/* Live account cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {liveAccounts.map((acc) => (
          <AccountLiveCard key={acc.id} account={acc} />
        ))}
      </div>

      <AccountForm />
    </div>
  );
}

function Metric({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums",
          positive === true && "text-emerald-400",
          positive === false && "text-red-400",
          positive === undefined && "text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}
