"use client";

import Link from "next/link";
import type { LiveInstrument, LiveSignal } from "@/lib/market-types";
import type { PositionPlan } from "@/lib/position-sizing";
import { cn } from "@/lib/cn";

interface Props {
  signal: LiveSignal;
  instrument: LiveInstrument;
  plans: PositionPlan[];
}

export function SignalPanel({ signal, instrument, plans }: Props) {
  const statusColor =
    signal.status === "SIGNAL"
      ? "border-emerald-800/60 bg-emerald-950/30"
      : signal.status === "WATCH"
        ? "border-amber-800/50 bg-amber-950/20"
        : "border-zinc-800 bg-zinc-900/40";

  const primary = plans[0] ?? null;
  const journalHref = buildJournalHref(instrument, signal, primary);

  return (
    <div className={cn("rounded-xl border p-4", statusColor)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">AI Signal</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{signal.summary}</h3>
        </div>
        <div className="flex gap-2 text-xs">
          {signal.model && (
            <span className="rounded bg-zinc-800 px-2 py-1 text-zinc-300">
              Model {signal.model === "RANGE" ? "1 Range" : "2 Trend"}
            </span>
          )}
          {signal.quality && (
            <span className="rounded bg-zinc-800 px-2 py-1 text-zinc-300">
              {signal.quality}
            </span>
          )}
          <span
            className={cn(
              "rounded px-2 py-1 font-medium",
              signal.status === "SIGNAL" && "bg-emerald-900/50 text-emerald-300",
              signal.status === "WATCH" && "bg-amber-900/40 text-amber-300",
              signal.status === "NO_TRADE" && "bg-zinc-800 text-zinc-400"
            )}
          >
            {signal.status}
          </span>
        </div>
      </div>

      {(signal.entryZone != null || signal.stop != null || primary) && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Metric label="Entry" value={primary?.entry ?? signal.entryZone} />
          <Metric label="Stop" value={primary?.stop ?? signal.stop} tone="stop" />
          <Metric label="Take (2R)" value={primary?.take ?? signal.targets[0] ?? null} tone="take" />
          <Metric
            label="Контракты"
            value={
              primary
                ? primary.contracts > 0
                  ? `${primary.contracts} ${instrument}`
                  : `${primary.microContracts} micro`
                : null
            }
          />
        </div>
      )}

      {plans.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-zinc-400">
            Риск 10% от max drawdown · стоп/тейк автоматически
          </p>
          {plans.map((p) => (
            <div
              key={p.accountId}
              className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-white">{p.accountName}</span>
                <span className="text-zinc-500">
                  DD ${p.maxDrawdown.toLocaleString()} → риск ${p.riskBudget.toLocaleString()}
                </span>
              </div>
              <p className="mt-1.5 font-mono text-zinc-300">
                Entry {p.entry} · Stop {p.stop} (−{p.stopPoints} пт) · Take {p.take} (+
                {p.takePoints} пт, {p.rewardRisk}:1)
              </p>
              <p className="mt-1 text-emerald-300">
                {p.contracts > 0 ? (
                  <>
                    Бери <strong>{p.contracts}</strong> × {instrument} (${p.pointValue}/пт) · риск ~
                    ${(p.contracts * p.riskPerContract).toFixed(0)}
                  </>
                ) : (
                  <>
                    Полный {instrument} не влезает — бери <strong>{p.microContracts}</strong> ×{" "}
                    {instrument === "NQ" ? "MNQ" : "MES"} (${p.microPointValue}/пт)
                  </>
                )}
              </p>
              <p className="mt-1 text-zinc-600">{p.note}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <List title="Reasons" items={signal.reasons} tone="ok" />
        <List title="Missing (до Rithmic OF)" items={signal.missing} tone="warn" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3">
        {journalHref && (
          <Link
            href={journalHref}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500"
          >
            Сохранить сигнал в журнал
          </Link>
        )}
        <a
          href="https://app.tradesea.ai"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-sky-400 hover:underline"
        >
          Исполнение → Tradesea
        </a>
        <Link href="/gex" className="text-xs text-zinc-500 hover:text-zinc-300">
          GEX уровни →
        </Link>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string | null | undefined;
  tone?: "stop" | "take";
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-2 py-1.5">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p
        className={cn(
          "font-mono text-sm tabular-nums",
          tone === "stop" && "text-red-400",
          tone === "take" && "text-emerald-400",
          !tone && "text-zinc-200"
        )}
      >
        {value == null || value === "" ? "—" : value}
      </p>
    </div>
  );
}

function List({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "ok" | "warn";
}) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-400">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item, i) => (
          <li
            key={i}
            className={cn("text-xs", tone === "ok" ? "text-zinc-300" : "text-amber-400/90")}
          >
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildJournalHref(
  instrument: LiveInstrument,
  signal: LiveSignal,
  plan: PositionPlan | null
): string | null {
  if (signal.status === "NO_TRADE" || !signal.model || !signal.direction) return null;
  const entry = plan?.entry ?? signal.entryZone;
  const stop = plan?.stop ?? signal.stop;
  const take = plan?.take ?? signal.targets[0];
  const contracts = plan?.contracts || plan?.microContracts || 1;
  const params = new URLSearchParams({
    fromSignal: "1",
    instrument,
    model: signal.model,
    direction: signal.direction,
    setupQuality: signal.quality ?? "B",
    entryPrice: entry != null ? String(entry) : "",
    stopPrice: stop != null ? String(stop) : "",
    targetPrice: take != null ? String(take) : "",
    contracts: String(contracts),
    notes: [
      `Live signal: ${signal.summary}`,
      plan?.note,
      ...signal.reasons,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return `/trades/new?${params.toString()}`;
}
