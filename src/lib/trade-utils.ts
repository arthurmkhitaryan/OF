import type { Trade } from "@prisma/client";
import type { TradeRecord } from "./types";

type TradeWithAccount = Trade & {
  account?: { name: string; firm: string } | null;
};

export function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function toTradeRecord(trade: TradeWithAccount): TradeRecord {
  return {
    id: trade.id,
    accountId: trade.accountId,
    accountName: trade.account?.name,
    accountFirm: trade.account?.firm,
    tradeDate: trade.tradeDate.toISOString(),
    instrument: trade.instrument as TradeRecord["instrument"],
    model: trade.model as TradeRecord["model"],
    direction: trade.direction as TradeRecord["direction"],
    entryType: trade.entryType as TradeRecord["entryType"],
    setupQuality: trade.setupQuality as TradeRecord["setupQuality"],
    session: trade.session as TradeRecord["session"],
    confirmations: parseJsonArray(trade.confirmations),
    mistakes: parseJsonArray(trade.mistakes),
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    stopPrice: trade.stopPrice,
    targetPrice: trade.targetPrice,
    contracts: trade.contracts,
    pnlDollars: trade.pnlDollars,
    pnlR: trade.pnlR,
    notes: trade.notes,
    screenshots: parseJsonArray(trade.screenshots),
    createdAt: trade.createdAt.toISOString(),
    updatedAt: trade.updatedAt.toISOString(),
  };
}

export function formatPnl(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}$${value.toFixed(2)}`;
}

export function formatR(value: number | null | undefined): string {
  if (value == null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}R`;
}

export function winRate(wins: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((wins / total) * 1000) / 10;
}
