import type { Account } from "@prisma/client";
import type { AccountRecord } from "./types";

export function toAccountRecord(
  account: Account & { _count?: { trades: number }; trades?: { pnlDollars: number }[] }
): AccountRecord {
  const totalPnl = account.trades?.reduce((s, t) => s + t.pnlDollars, 0);
  return {
    id: account.id,
    name: account.name,
    firm: account.firm,
    type: account.type as AccountRecord["type"],
    status: account.status as AccountRecord["status"],
    size: account.size,
    notes: account.notes,
    color: account.color,
    startingBalance: account.startingBalance,
    currentBalance: account.currentBalance,
    profitTarget: account.profitTarget,
    maxDrawdown: account.maxDrawdown,
    dailyLossLimit: account.dailyLossLimit,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    tradeCount: account._count?.trades,
    totalPnl,
  };
}
