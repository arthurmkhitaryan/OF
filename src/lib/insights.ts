import type { TradeRecord } from "./types";
import { LABELS } from "./constants";
import { winRate } from "./trade-utils";

export interface MistakeInsight {
  tag: string;
  label: string;
  count: number;
  totalCost: number;
  avgCost: number;
  percentOfLosses: number;
}

export interface MonthlyInsight {
  summary: string;
  strengths: string[];
  problems: string[];
  recommendations: string[];
  mistakes: MistakeInsight[];
  overtradingDays: number;
  aPlusWinRate: number;
  bQualityWinRate: number;
  wrongModelCount: number;
}

export function analyzeMonth(trades: TradeRecord[]): MonthlyInsight {
  const losses = trades.filter((t) => t.pnlDollars < 0);
  const wins = trades.filter((t) => t.pnlDollars > 0);

  const mistakeMap = new Map<string, { count: number; cost: number }>();
  for (const trade of trades) {
    for (const tag of trade.mistakes) {
      const existing = mistakeMap.get(tag) ?? { count: 0, cost: 0 };
      existing.count += 1;
      if (trade.pnlDollars < 0) existing.cost += Math.abs(trade.pnlDollars);
      mistakeMap.set(tag, existing);
    }
  }

  const mistakes: MistakeInsight[] = Array.from(mistakeMap.entries())
    .map(([tag, data]) => ({
      tag,
      label: LABELS[tag] ?? tag,
      count: data.count,
      totalCost: data.cost,
      avgCost: data.count > 0 ? data.cost / data.count : 0,
      percentOfLosses:
        losses.length > 0
          ? Math.round((data.count / losses.length) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  const dailyTradeCount = new Map<string, number>();
  for (const t of trades) {
    const day = t.tradeDate.slice(0, 10);
    dailyTradeCount.set(day, (dailyTradeCount.get(day) ?? 0) + 1);
  }
  const overtradingDays = Array.from(dailyTradeCount.values()).filter((c) => c > 3).length;

  const aPlus = trades.filter((t) => t.setupQuality === "A_PLUS" || t.setupQuality === "A");
  const bQuality = trades.filter((t) => t.setupQuality === "B" || t.setupQuality === "C");
  const aPlusWins = aPlus.filter((t) => t.pnlDollars > 0).length;
  const bWins = bQuality.filter((t) => t.pnlDollars > 0).length;

  const wrongModelCount = trades.filter((t) => t.mistakes.includes("wrong_model")).length;
  const totalPnl = trades.reduce((s, t) => s + t.pnlDollars, 0);
  const wr = winRate(wins.length, trades.length);

  const problems: string[] = [];
  const strengths: string[] = [];
  const recommendations: string[] = [];

  if (mistakes[0]) {
    problems.push(
      `Главная ошибка: «${mistakes[0].label}» — ${mistakes[0].count} раз, стоило $${mistakes[0].totalCost.toFixed(0)}`
    );
  }
  if (overtradingDays > 0) {
    problems.push(`Перетрейдинг: ${overtradingDays} дней с >3 сделками (лимит стратегии — 2-3)`);
    recommendations.push("Строго максимум 3 сделки в день. Нет сетапа = нет сделки.");
  }
  if (wrongModelCount > 0) {
    problems.push(`Неверная модель: ${wrongModelCount} сделок (Range в trend или наоборот)`);
    recommendations.push("Первые 30-60 мин RTH определи balanced/imbalanced — потом выбирай модель.");
  }
  const noConfirm = mistakes.find((m) => m.tag === "no_confirmation");
  if (noConfirm && noConfirm.count >= 2) {
    problems.push(`Входы без подтверждения: ${noConfirm.count} раз`);
    recommendations.push("Жди минимум 2 AOI + order flow confirmation. Anticipation = no trade.");
  }
  const middleRange = mistakes.find((m) => m.tag === "traded_middle_of_range");
  if (middleRange) {
    problems.push(`Торговля середины range: ${middleRange.count} раз`);
    recommendations.push("Model 1 — только VAH/VAL. Середина = NO TRADE.");
  }

  if (aPlus.length >= 3 && winRate(aPlusWins, aPlus.length) >= 50) {
    strengths.push(`A/A+ сетапы работают: ${winRate(aPlusWins, aPlus.length)}% WR на ${aPlus.length} сделках`);
  }
  if (bQuality.length > 0 && winRate(bWins, bQuality.length) < 40) {
    problems.push(`B/C сетапы слабые: ${winRate(bWins, bQuality.length)}% WR — фильтруй качество`);
    recommendations.push("Торгуй только A и A+ сетапы. B/C — в журнал, но не в live.");
  }
  if (totalPnl > 0 && wr >= 50) {
    strengths.push(`Прибыльный месяц: +$${totalPnl.toFixed(0)} при ${wr}% win rate`);
  }
  if (totalPnl < 0) {
    recommendations.push("Сфокусируйся на 1 модели которая дала лучший WR в этом месяце.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Продолжай вести журнал со скриншотами — данных пока мало для глубокого анализа.");
  }

  const summary =
    trades.length === 0
      ? "Нет сделок за период."
      : totalPnl >= 0
        ? `Месяц закрыт в плюс (+$${totalPnl.toFixed(0)}). ${problems.length > 0 ? `Но есть ${problems.length} зон для улучшения.` : "Дисциплина на хорошем уровне."}`
        : `Месяц в минусе ($${totalPnl.toFixed(0)}). Главный фокус: ${mistakes[0]?.label ?? "качество сетапов"}.`;

  return {
    summary,
    strengths,
    problems,
    recommendations,
    mistakes,
    overtradingDays,
    aPlusWinRate: winRate(aPlusWins, aPlus.length),
    bQualityWinRate: winRate(bWins, bQuality.length),
    wrongModelCount,
  };
}
