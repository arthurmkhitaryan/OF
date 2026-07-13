"use client";

import { cn } from "@/lib/cn";
import {
  AOI_LEVELS,
  getChecklistForModel,
  getRequiredChecklistKeys,
  MARKET_CONDITION_SIGNS,
} from "@/lib/playbook";
import type { Model } from "@/lib/types";
import { CheckCircle2, Circle, Info } from "lucide-react";

interface StrategyPlaybookProps {
  model: Model;
  confirmations: string[];
  onToggle: (key: string) => void;
  onModelChange?: (model: Model) => void;
}

export function StrategyPlaybook({
  model,
  confirmations,
  onToggle,
  onModelChange,
}: StrategyPlaybookProps) {
  const checklist = getChecklistForModel(model);
  const requiredKeys = getRequiredChecklistKeys(model);
  const checkedRequired = requiredKeys.filter((k) => confirmations.includes(k)).length;
  const aoiChecked = AOI_LEVELS.filter((l) => confirmations.includes(l.key)).length;

  return (
    <div className="space-y-6">
      {/* Balanced vs Imbalanced */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
          Как понять: Balanced или Imbalanced день?
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Открой Volume Profile и посмотри на поведение цены в первые 30–60 мин RTH.
          Это определяет, какую модель использовать сегодня.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ConditionCard
            type="balanced"
            selected={model === "RANGE"}
            onSelect={() => onModelChange?.("RANGE")}
          />
          <ConditionCard
            type="imbalanced"
            selected={model === "TREND"}
            onSelect={() => onModelChange?.("TREND")}
          />
        </div>
      </div>

      {/* Model plan */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
              {model === "RANGE"
                ? "Model 1 — Range (Balanced Market)"
                : "Model 2 — Trend (Imbalanced Market)"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {model === "RANGE" ? (
                <>
                  Рынок ротирует внутри диапазона. Торгуем <strong className="text-zinc-200">только края</strong> — VAH (short) и VAL (long).
                  Ждём, когда одна сторона пытается пробить уровень и <strong className="text-zinc-200">терпит неудачу</strong> (absorption + trapped traders).
                  Не предсказываем разворот — реагируем на failure.
                </>
              ) : (
                <>
                  Рынок трендовый — одна сторона контролирует. <strong className="text-zinc-200">Не фейдим</strong> движение.
                  Ждём агрессивный move → формирование LVN → pullback в зону.
                  Входим, когда противоположная сторона агрессивна, но <strong className="text-zinc-200">не может продолжить</strong> против тренда.
                </>
              )}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
              model === "RANGE"
                ? "bg-blue-950 text-blue-300"
                : "bg-emerald-950 text-emerald-300"
            )}
          >
            {checkedRequired}/{requiredKeys.length} обязательных
          </span>
        </div>

        {/* Step-by-step plan */}
        <div className="mt-5 space-y-1">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            План сделки — чеклист
          </h3>
          {checklist.map((item, i) => (
            <ChecklistRow
              key={item.key}
              index={i + 1}
              item={item}
              checked={confirmations.includes(item.key)}
              onToggle={() => onToggle(item.key)}
            />
          ))}
        </div>
      </div>

      {/* AOI levels */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
            Уровни AOI на сетапе ({aoiChecked}/13)
          </h2>
          <span className="text-xs text-zinc-500">минимум 2 для валидного уровня</span>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Отметь, какие инструменты совпали на твоём Area of Interest
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {AOI_LEVELS.map((item) => (
            <label
              key={item.key}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                confirmations.includes(item.key)
                  ? "border-emerald-800 bg-emerald-950/30 text-emerald-300"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700"
              )}
            >
              <input
                type="checkbox"
                checked={confirmations.includes(item.key)}
                onChange={() => onToggle(item.key)}
                className="accent-emerald-500"
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConditionCard({
  type,
  selected,
  onSelect,
}: {
  type: "balanced" | "imbalanced";
  selected: boolean;
  onSelect: () => void;
}) {
  const data = MARKET_CONDITION_SIGNS[type];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-4 text-left transition",
        selected
          ? type === "balanced"
            ? "border-blue-700 bg-blue-950/30 ring-1 ring-blue-600/50"
            : "border-emerald-700 bg-emerald-950/30 ring-1 ring-emerald-600/50"
          : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold",
          type === "balanced" ? "text-blue-300" : "text-emerald-300"
        )}
      >
        {data.title}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{data.subtitle}</p>

      <ul className="mt-3 space-y-1.5">
        {data.signs.map((sign) => (
          <li key={sign} className="flex items-start gap-2 text-xs text-zinc-400">
            <span className={type === "balanced" ? "text-blue-500" : "text-emerald-500"}>
              •
            </span>
            {sign}
          </li>
        ))}
      </ul>

      <p
        className={cn(
          "mt-3 rounded-lg px-3 py-2 text-xs font-medium",
          type === "balanced" ? "bg-blue-950/50 text-blue-200" : "bg-emerald-950/50 text-emerald-200"
        )}
      >
        → {data.action}
      </p>
    </button>
  );
}

function ChecklistRow({
  index,
  item,
  checked,
  onToggle,
}: {
  index: number;
  item: { key: string; label: string; hint?: string; required?: boolean };
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition hover:bg-zinc-800/40",
        checked && "bg-zinc-800/30"
      )}
    >
      <button type="button" onClick={onToggle} className="mt-0.5 shrink-0">
        {checked ? (
          <CheckCircle2 size={18} className="text-emerald-400" />
        ) : (
          <Circle size={18} className="text-zinc-600" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-600">{index}.</span>
          <span className={cn("text-sm", checked ? "text-zinc-200" : "text-zinc-400")}>
            {item.label}
          </span>
          {item.required && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
              обяз.
            </span>
          )}
        </div>
        {item.hint && (
          <p className="mt-0.5 flex items-center gap-1 pl-5 text-xs text-zinc-600">
            <Info size={11} />
            {item.hint}
          </p>
        )}
      </div>
    </label>
  );
}
