import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { TradeRecord } from "@/lib/types";
import { LABELS } from "@/lib/constants";
import { formatPnl, formatR } from "@/lib/trade-utils";
import { cn } from "@/lib/cn";

interface TradeListProps {
  trades: TradeRecord[];
  showAccount?: boolean;
}

export function TradeList({ trades, showAccount = false }: TradeListProps) {
  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
        <p className="text-zinc-400">Сделок пока нет</p>
        <Link
          href="/trades/new"
          className="mt-4 inline-block text-sm text-emerald-400 hover:underline"
        >
          Добавить первую сделку →
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3">Дата</th>
            {showAccount && <th className="px-4 py-3">Аккаунт</th>}
            <th className="px-4 py-3">Инструмент</th>
            <th className="px-4 py-3">Модель</th>
            <th className="px-4 py-3">Направление</th>
            <th className="px-4 py-3">Качество</th>
            <th className="px-4 py-3">P&L</th>
            <th className="px-4 py-3">R</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr
              key={trade.id}
              className="border-b border-zinc-800/60 hover:bg-zinc-900/40"
            >
              <td className="px-4 py-3 text-zinc-300">
                {format(new Date(trade.tradeDate), "d MMM yyyy", { locale: ru })}
              </td>
              {showAccount && (
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {trade.accountName ?? "—"}
                </td>
              )}
              <td className="px-4 py-3 font-medium text-white">{trade.instrument}</td>
              <td className="px-4 py-3 text-zinc-400">{LABELS[trade.model]}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium",
                    trade.direction === "LONG"
                      ? "bg-emerald-950 text-emerald-400"
                      : "bg-red-950 text-red-400"
                  )}
                >
                  {LABELS[trade.direction]}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-400">{LABELS[trade.setupQuality]}</td>
              <td
                className={cn(
                  "px-4 py-3 font-medium tabular-nums",
                  trade.pnlDollars >= 0 ? "text-emerald-400" : "text-red-400"
                )}
              >
                {formatPnl(trade.pnlDollars)}
              </td>
              <td className="px-4 py-3 tabular-nums text-zinc-400">
                {formatR(trade.pnlR)}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/trades/${trade.id}`}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  Открыть
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
