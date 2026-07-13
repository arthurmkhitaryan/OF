"use client";

import { useMemo } from "react";
import { formatPnl } from "@/lib/trade-utils";
import { cn } from "@/lib/cn";
import type { MonthlyReport } from "@/lib/reports";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export function MonthlyReportView({ report }: { report: MonthlyReport }) {
  const { stats, insight } = report;

  const modelData = useMemo(
    () =>
      Object.entries(stats.byModel).map(([model, d]) => ({
        name: model === "RANGE" ? "Range" : "Trend",
        pnl: d.pnl,
        trades: d.trades,
        winRate: d.winRate,
      })),
    [stats.byModel]
  );

  const weekData = report.byWeek.map((w) => ({
    name: w.week.replace("W", "Н"),
    pnl: w.pnl,
  }));

  return (
    <div className="space-y-8">
      {/* Executive summary */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
              Бизнес-отчёт
            </p>
            <h2 className="mt-1 text-2xl font-semibold capitalize text-white">
              {report.monthLabel}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{report.accountName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">Net P&L</p>
            <p
              className={cn(
                "text-3xl font-bold tabular-nums",
                stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
              )}
            >
              {formatPnl(stats.totalPnl)}
            </p>
            {report.pnlChange != null && (
              <p className="text-xs text-zinc-500">
                vs прошлый месяц:{" "}
                <span className={report.pnlChange >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {report.pnlChange >= 0 ? "+" : ""}
                  {formatPnl(report.pnlChange)}
                </span>
              </p>
            )}
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">{insight.summary}</p>
      </section>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Сделок" value={String(stats.totalTrades)} />
        <Kpi label="Win Rate" value={`${stats.winRate}%`} />
        <Kpi
          label="Profit Factor"
          value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
        />
        <Kpi label="Торговых дней" value={String(report.tradingDays)} />
        <Kpi
          label="Avg P&L / день"
          value={formatPnl(report.avgPnlPerDay)}
          positive={report.avgPnlPerDay >= 0}
        />
        <Kpi
          label="Avg P&L / сделка"
          value={formatPnl(report.avgPnlPerTrade)}
          positive={report.avgPnlPerTrade >= 0}
        />
        <Kpi label="Зелёных дней" value={String(report.greenDays)} positive />
        <Kpi label="Красных дней" value={String(report.redDays)} positive={false} />
      </div>

      {/* Problems & recommendations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <InsightBlock title="Что пошло не так" items={insight.problems} variant="problem" />
        <InsightBlock title="Рекомендации" items={insight.recommendations} variant="action" />
      </div>

      {insight.strengths.length > 0 && (
        <InsightBlock title="Сильные стороны" items={insight.strengths} variant="strength" />
      )}

      {/* Mistakes table */}
      {insight.mistakes.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">Анализ ошибок</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Сколько каждая ошибка стоила в долларах — фокус на топ-3
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                  <th className="pb-2 pr-4">Ошибка</th>
                  <th className="pb-2 pr-4">Раз</th>
                  <th className="pb-2 pr-4">Стоимость $</th>
                  <th className="pb-2">% убытков</th>
                </tr>
              </thead>
              <tbody>
                {insight.mistakes.slice(0, 8).map((m) => (
                  <tr key={m.tag} className="border-b border-zinc-800/50">
                    <td className="py-2.5 pr-4 text-zinc-300">{m.label}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-zinc-400">{m.count}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-red-400">
                      ${m.totalCost.toFixed(0)}
                    </td>
                    <td className="py-2.5 tabular-nums text-zinc-500">{m.percentOfLosses}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="P&L по неделям">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekData}>
              <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 10 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }}
                formatter={(v) => [formatPnl(Number(v ?? 0)), "P&L"]}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {weekData.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? "#34d399" : "#f87171"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Модели: Range vs Trend">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={modelData}>
              <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 10 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }}
                formatter={(v, name) => [
                  name === "pnl" ? formatPnl(Number(v ?? 0)) : String(v ?? 0),
                  name === "pnl" ? "P&L" : "Сделок",
                ]}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {modelData.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? "#60a5fa" : "#f87171"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex gap-4 text-xs text-zinc-500">
            {modelData.map((m) => (
              <span key={m.name}>
                {m.name}: {m.trades} сд. · {m.winRate}% WR
              </span>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Best / worst day */}
      {(report.bestDay || report.worstDay) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {report.bestDay && (
            <DayCard label="Лучший день" date={report.bestDay.date} pnl={report.bestDay.pnl} positive />
          )}
          {report.worstDay && (
            <DayCard label="Худший день" date={report.worstDay.date} pnl={report.worstDay.pnl} positive={false} />
          )}
        </div>
      )}

      {/* Per-account breakdown */}
      {report.accountsBreakdown.length > 1 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">По аккаунтам</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.accountsBreakdown.map((a) => (
              <div key={a.id} className="rounded-lg border border-zinc-800 p-3">
                <p className="text-sm font-medium text-white">{a.name}</p>
                <p className={cn("text-lg font-semibold tabular-nums", a.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {formatPnl(a.pnl)}
                </p>
                <p className="text-xs text-zinc-500">{a.trades} сделок · {a.winRate}% WR</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quality insight */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h3 className="text-sm font-semibold text-white">Качество сетапов</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <QualityMetric label="A/A+ Win Rate" value={`${insight.aPlusWinRate}%`} />
          <QualityMetric label="B/C Win Rate" value={`${insight.bQualityWinRate}%`} />
          <QualityMetric label="Неверная модель" value={String(insight.wrongModelCount)} bad />
        </div>
        {insight.overtradingDays > 0 && (
          <p className="mt-3 text-sm text-amber-400">
            Перетрейдинг: {insight.overtradingDays} дней с более чем 3 сделками
          </p>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
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

function InsightBlock({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "problem" | "action" | "strength";
}) {
  if (items.length === 0) return null;
  const borderColor =
    variant === "problem"
      ? "border-red-900/50"
      : variant === "action"
        ? "border-emerald-900/50"
        : "border-blue-900/50";

  return (
    <section className={cn("rounded-xl border bg-zinc-900/40 p-5", borderColor)}>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-zinc-300">
            <span className="text-zinc-600">•</span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DayCard({
  label,
  date,
  pnl,
  positive,
}: {
  label: string;
  date: string;
  pnl: number;
  positive: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm text-zinc-400">{date}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", positive ? "text-emerald-400" : "text-red-400")}>
        {formatPnl(pnl)}
      </p>
    </div>
  );
}

function QualityMetric({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={cn("text-lg font-semibold", bad && +value > 0 ? "text-red-400" : "text-white")}>
        {value}
      </p>
    </div>
  );
}
