import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import type { TradeRecord } from "./types";
import { calculateStats } from "./stats";
import { analyzeMonth } from "./insights";
import { winRate } from "./trade-utils";
import { prisma } from "./prisma";
import { ensureAccountsReady } from "./accounts";
import { toTradeRecord } from "./trade-utils";

export interface MonthlyReport {
  month: string;
  monthLabel: string;
  accountId: string | "all";
  accountName: string;
  stats: ReturnType<typeof calculateStats>;
  insight: ReturnType<typeof analyzeMonth>;
  tradingDays: number;
  avgPnlPerDay: number;
  avgPnlPerTrade: number;
  greenDays: number;
  redDays: number;
  bestDay: { date: string; pnl: number } | null;
  worstDay: { date: string; pnl: number } | null;
  prevMonthPnl: number | null;
  pnlChange: number | null;
  byWeek: { week: string; pnl: number; trades: number }[];
  accountsBreakdown: {
    id: string;
    name: string;
    pnl: number;
    trades: number;
    winRate: number;
  }[];
}

function getMonthRange(year: number, month: number) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  return { start, end };
}

export async function getMonthlyReport(
  year: number,
  month: number,
  accountId?: string | null
): Promise<MonthlyReport> {
  await ensureAccountsReady();

  const { start, end } = getMonthRange(year, month);
  const prevStart = subMonths(start, 1);
  const prevEnd = endOfMonth(prevStart);

  const accountFilter = accountId && accountId !== "all" ? { accountId } : {};

  const [trades, prevTrades, accounts] = await Promise.all([
    prisma.trade.findMany({
      where: {
        ...accountFilter,
        tradeDate: { gte: start, lte: end },
      },
      include: { account: { select: { name: true, firm: true } } },
      orderBy: { tradeDate: "asc" },
    }),
    prisma.trade.findMany({
      where: {
        ...accountFilter,
        tradeDate: { gte: prevStart, lte: prevEnd },
      },
    }),
    prisma.account.findMany({ select: { id: true, name: true } }),
  ]);

  const records = trades.map(toTradeRecord);
  const stats = calculateStats(records);
  const insight = analyzeMonth(records);

  const dailyPnl = stats.dailyPnl;
  const tradingDays = dailyPnl.length;
  const greenDays = dailyPnl.filter((d) => d.pnl > 0).length;
  const redDays = dailyPnl.filter((d) => d.pnl < 0).length;
  const bestDay = dailyPnl.length
    ? dailyPnl.reduce((a, b) => (b.pnl > a.pnl ? b : a))
    : null;
  const worstDay = dailyPnl.length
    ? dailyPnl.reduce((a, b) => (b.pnl < a.pnl ? b : a))
    : null;

  const prevMonthPnl = prevTrades.reduce((s, t) => s + t.pnlDollars, 0);
  const pnlChange = prevTrades.length > 0 ? stats.totalPnl - prevMonthPnl : null;

  const byWeekMap = new Map<string, { pnl: number; trades: number }>();
  for (const t of records) {
    const d = new Date(t.tradeDate);
    const weekStart = format(d, "yyyy-'W'ww");
    const existing = byWeekMap.get(weekStart) ?? { pnl: 0, trades: 0 };
    existing.pnl += t.pnlDollars;
    existing.trades += 1;
    byWeekMap.set(weekStart, existing);
  }

  const accountsBreakdown =
    accountId === "all" || !accountId
      ? Object.entries(stats.byAccount).map(([id, data]) => ({
          id,
          name: data.name,
          pnl: data.pnl,
          trades: data.trades,
          winRate: data.winRate,
        }))
      : [];

  let accountName = "Все счета";
  if (accountId && accountId !== "all") {
    accountName = accounts.find((a) => a.id === accountId)?.name ?? "Счёт";
  }

  return {
    month: format(start, "yyyy-MM"),
    monthLabel: format(start, "LLLL yyyy", { locale: ru }),
    accountId: accountId ?? "all",
    accountName,
    stats,
    insight,
    tradingDays,
    avgPnlPerDay: tradingDays > 0 ? stats.totalPnl / tradingDays : 0,
    avgPnlPerTrade: stats.totalTrades > 0 ? stats.totalPnl / stats.totalTrades : 0,
    greenDays,
    redDays,
    bestDay,
    worstDay,
    prevMonthPnl: prevTrades.length > 0 ? prevMonthPnl : null,
    pnlChange,
    byWeek: Array.from(byWeekMap.entries()).map(([week, data]) => ({ week, ...data })),
    accountsBreakdown,
  };
}

export interface AccountLiveStatus {
  id: string;
  name: string;
  firm: string;
  color: string;
  status: string;
  type: string;
  size: number | null;
  startingBalance: number | null;
  currentBalance: number | null;
  profitTarget: number | null;
  maxDrawdown: number | null;
  dailyLossLimit: number | null;
  pnlFromTrades: number;
  pnlToday: number;
  pnlThisWeek: number;
  pnlThisMonth: number;
  tradesToday: number;
  drawdownUsed: number | null;
  profitProgress: number | null;
  dailyLossUsed: number | null;
  lastSnapshot: string | null;
}

export async function getAccountsLiveStatus(): Promise<AccountLiveStatus[]> {
  await ensureAccountsReady();

  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const monthStart = startOfMonth(now);

  const accounts = await prisma.account.findMany({
    include: {
      trades: true,
      snapshots: { orderBy: { date: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  return accounts.map((acc) => {
    const pnlFromTrades = acc.trades.reduce((s, t) => s + t.pnlDollars, 0);
    const todayTrades = acc.trades.filter(
      (t) => format(t.tradeDate, "yyyy-MM-dd") === todayStr
    );
    const pnlToday = todayTrades.reduce((s, t) => s + t.pnlDollars, 0);
    const weekTrades = acc.trades.filter((t) => t.tradeDate >= weekStart);
    const pnlThisWeek = weekTrades.reduce((s, t) => s + t.pnlDollars, 0);
    const monthTrades = acc.trades.filter((t) => t.tradeDate >= monthStart);
    const pnlThisMonth = monthTrades.reduce((s, t) => s + t.pnlDollars, 0);

    const drawdownUsed =
      acc.startingBalance != null && acc.currentBalance != null
        ? Math.max(0, acc.startingBalance - acc.currentBalance)
        : null;

    const profitProgress =
      acc.profitTarget != null && acc.profitTarget > 0
        ? Math.min(100, (pnlFromTrades / acc.profitTarget) * 100)
        : null;

    const dailyLossUsed =
      acc.dailyLossLimit != null ? Math.abs(Math.min(0, pnlToday)) : null;

    return {
      id: acc.id,
      name: acc.name,
      firm: acc.firm,
      color: acc.color,
      status: acc.status,
      type: acc.type,
      size: acc.size,
      startingBalance: acc.startingBalance,
      currentBalance: acc.currentBalance,
      profitTarget: acc.profitTarget,
      maxDrawdown: acc.maxDrawdown,
      dailyLossLimit: acc.dailyLossLimit,
      pnlFromTrades,
      pnlToday,
      pnlThisWeek,
      pnlThisMonth,
      tradesToday: todayTrades.length,
      drawdownUsed,
      profitProgress,
      dailyLossUsed,
      lastSnapshot: acc.snapshots[0]?.date.toISOString() ?? null,
    };
  });
}
