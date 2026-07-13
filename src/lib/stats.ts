import type { TradeRecord, TradeStats } from "./types";
import { toTradeRecord, winRate } from "./trade-utils";
import { prisma } from "./prisma";
import { ensureAccountsReady } from "./accounts";
import { format } from "date-fns";

function groupStats(trades: TradeRecord[], key: keyof TradeRecord) {
  const groups: Record<string, { trades: number; pnl: number; wins: number }> = {};

  for (const trade of trades) {
    const groupKey = String(trade[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = { trades: 0, pnl: 0, wins: 0 };
    }
    groups[groupKey].trades += 1;
    groups[groupKey].pnl += trade.pnlDollars;
    if (trade.pnlDollars > 0) groups[groupKey].wins += 1;
  }

  return Object.fromEntries(
    Object.entries(groups).map(([k, v]) => [
      k,
      { trades: v.trades, pnl: v.pnl, winRate: winRate(v.wins, v.trades) },
    ])
  );
}

function groupByAccount(trades: TradeRecord[]) {
  const groups: Record<string, { trades: number; pnl: number; wins: number; name: string; firm: string }> = {};

  for (const trade of trades) {
    if (!groups[trade.accountId]) {
      groups[trade.accountId] = {
        trades: 0,
        pnl: 0,
        wins: 0,
        name: trade.accountName ?? "Unknown",
        firm: trade.accountFirm ?? "",
      };
    }
    groups[trade.accountId].trades += 1;
    groups[trade.accountId].pnl += trade.pnlDollars;
    if (trade.pnlDollars > 0) groups[trade.accountId].wins += 1;
  }

  return Object.fromEntries(
    Object.entries(groups).map(([k, v]) => [
      k,
      {
        name: v.name,
        firm: v.firm,
        trades: v.trades,
        pnl: v.pnl,
        winRate: winRate(v.wins, v.trades),
      },
    ])
  );
}

export function calculateStats(trades: TradeRecord[]): TradeStats {
  const wins = trades.filter((t) => t.pnlDollars > 0);
  const losses = trades.filter((t) => t.pnlDollars < 0);
  const totalPnl = trades.reduce((sum, t) => sum + t.pnlDollars, 0);
  const grossProfit = wins.reduce((sum, t) => sum + t.pnlDollars, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnlDollars, 0));
  const rValues = trades.map((t) => t.pnlR).filter((r): r is number => r != null);

  const dailyMap = new Map<string, { pnl: number; trades: number }>();
  for (const trade of trades) {
    const date = format(new Date(trade.tradeDate), "yyyy-MM-dd");
    const existing = dailyMap.get(date) ?? { pnl: 0, trades: 0 };
    existing.pnl += trade.pnlDollars;
    existing.trades += 1;
    dailyMap.set(date, existing);
  }

  return {
    totalTrades: trades.length,
    winRate: winRate(wins.length, trades.length),
    totalPnl,
    avgWin: wins.length ? grossProfit / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    expectancy: trades.length ? totalPnl / trades.length : 0,
    avgR: rValues.length ? rValues.reduce((a, b) => a + b, 0) / rValues.length : 0,
    bestTrade: trades.length ? Math.max(...trades.map((t) => t.pnlDollars)) : 0,
    worstTrade: trades.length ? Math.min(...trades.map((t) => t.pnlDollars)) : 0,
    byInstrument: groupStats(trades, "instrument"),
    byModel: groupStats(trades, "model"),
    byEntryType: groupStats(trades, "entryType"),
    byQuality: groupStats(trades, "setupQuality"),
    byAccount: groupByAccount(trades),
    dailyPnl: Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    recentTrades: [...trades]
      .sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime())
      .slice(0, 10),
  };
}

export async function getStats(accountId?: string | null): Promise<TradeStats> {
  await ensureAccountsReady();

  const where = accountId && accountId !== "all" ? { accountId } : undefined;

  const trades = await prisma.trade.findMany({
    where,
    include: { account: { select: { name: true, firm: true } } },
    orderBy: { tradeDate: "desc" },
  });

  return calculateStats(trades.map(toTradeRecord));
}

export async function getAllStats(): Promise<TradeStats> {
  return getStats("all");
}
