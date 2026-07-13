import { formatPnl } from "@/lib/trade-utils";
import { ACCOUNT_LABELS } from "@/lib/account-constants";
import { BalanceSync } from "@/components/BalanceSync";
import { cn } from "@/lib/cn";
import type { AccountLiveStatus } from "@/lib/reports";

function ProgressBar({
  label,
  used,
  limit,
  color = "emerald",
}: {
  label: string;
  used: number;
  limit: number;
  color?: "emerald" | "red" | "amber";
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const colorClass =
    color === "red"
      ? "bg-red-500"
      : color === "amber"
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div>
      <div className="flex justify-between text-[10px]">
        <span className="text-zinc-500">{label}</span>
        <span className="tabular-nums text-zinc-400">
          ${used.toFixed(0)} / ${limit.toFixed(0)} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn("h-full rounded-full transition-all", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AccountLiveCard({ account }: { account: AccountLiveStatus }) {
  const pnlColor = (v: number) => (v >= 0 ? "text-emerald-400" : "text-red-400");

  return (
    <div
      className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
      style={{ borderLeftColor: account.color, borderLeftWidth: 3 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white">{account.name}</h3>
          <p className="text-xs text-zinc-500">
            {account.firm} · {ACCOUNT_LABELS[account.type]} · {ACCOUNT_LABELS[account.status]}
            {account.size ? ` · ${account.size}K` : ""}
          </p>
        </div>
        {account.currentBalance != null && (
          <div className="text-right">
            <p className="text-[10px] text-zinc-500">Баланс</p>
            <p className="text-sm font-semibold tabular-nums text-white">
              ${account.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 0 })}
            </p>
          </div>
        )}
      </div>

      {/* Live P&L from journal */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-zinc-500">Сегодня</p>
          <p className={cn("text-sm font-semibold tabular-nums", pnlColor(account.pnlToday))}>
            {formatPnl(account.pnlToday)}
          </p>
          <p className="text-[10px] text-zinc-600">{account.tradesToday} сделок</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500">Неделя</p>
          <p className={cn("text-sm font-semibold tabular-nums", pnlColor(account.pnlThisWeek))}>
            {formatPnl(account.pnlThisWeek)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500">Месяц</p>
          <p className={cn("text-sm font-semibold tabular-nums", pnlColor(account.pnlThisMonth))}>
            {formatPnl(account.pnlThisMonth)}
          </p>
        </div>
      </div>

      {/* Prop firm limits */}
      <div className="mt-4 space-y-2">
        {account.profitTarget != null && account.profitProgress != null && (
          <ProgressBar
            label="Прогресс к цели"
            used={Math.max(0, account.pnlFromTrades)}
            limit={account.profitTarget}
            color="emerald"
          />
        )}
        {account.maxDrawdown != null && account.drawdownUsed != null && account.drawdownUsed > 0 && (
          <ProgressBar
            label="Просадка"
            used={account.drawdownUsed}
            limit={account.maxDrawdown}
            color="red"
          />
        )}
        {account.dailyLossLimit != null && account.dailyLossUsed != null && account.dailyLossUsed > 0 && (
          <ProgressBar
            label="Дневной лимит"
            used={account.dailyLossUsed}
            limit={account.dailyLossLimit}
            color="amber"
          />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3">
        <div>
          <p className="text-[10px] text-zinc-500">Всего P&L (журнал)</p>
          <p className={cn("text-lg font-semibold tabular-nums", pnlColor(account.pnlFromTrades))}>
            {formatPnl(account.pnlFromTrades)}
          </p>
        </div>
        <BalanceSync
          accountId={account.id}
          accountName={account.name}
          currentBalance={account.currentBalance}
        />
      </div>
    </div>
  );
}
