import type { Model } from "./types";

export interface ChecklistItem {
  key: string;
  label: string;
  hint?: string;
  required?: boolean;
}

export const MARKET_CONDITION_SIGNS = {
  balanced: {
    title: "Balanced (Range) — сбалансированный день",
    subtitle: "Используй Model 1 — Range",
    color: "blue",
    signs: [
      "Цена торгуется внутри Value Area (70% объёма)",
      "Объём концентрирован в середине диапазона",
      "Брейкауты не имеют follow-through — цена возвращается",
      "Value Area не смещается — buyers и sellers в равновесии",
      "Цена часто разворачивается на одних и тех же уровнях",
      "Нет чёткого направления — ротация туда-сюда",
    ],
    action: "Торгуй только края: VAH (short) и VAL (long). Середина диапазона — NO TRADE.",
  },
  imbalanced: {
    title: "Imbalanced (Trend) — несбалансированный день",
    subtitle: "Используй Model 2 — Trend",
    color: "emerald",
    signs: [
      "Value Area смещается выше (bull) или ниже (bear)",
      "Сильное направленное движение с follow-through",
      "Формируются LVN — цена прошла быстро, мало объёма",
      "Pullbacks мелкие и короткие",
      "Одна сторона явно контролирует рынок",
      "Противоположная сторона не может удержать уровень",
    ],
    action: "Не фейди движение. Жди pullback в LVN и входи по тренду.",
  },
} as const;

export const RANGE_CHECKLIST: ChecklistItem[] = [
  {
    key: "range_market_confirmed",
    label: "Рынок balanced — цена внутри Value Area",
    hint: "Value не смещается, брейкауты откатываются",
    required: true,
  },
  {
    key: "range_at_edge",
    label: "Цена у края диапазона (VAH или VAL)",
    hint: "НЕ в середине range — там NO TRADE",
    required: true,
  },
  {
    key: "range_aoi_2plus",
    label: "Минимум 2 подтверждения AOI на уровне",
    hint: "PDH/PDL/ONH/ONL/PDC/ORB + Volume Profile",
    required: true,
  },
  {
    key: "range_absorption",
    label: "Вижу absorption — heavy delta, цена не движется",
    hint: "Пассивный участник поглощает агрессию",
  },
  {
    key: "range_big_trades_fail",
    label: "Big trades не могут протолкнуть цену дальше",
    hint: "NQ 75+ / ES 200+ lots без continuation",
  },
  {
    key: "range_trapped",
    label: "Trapped traders — look above/below and fail",
    hint: "Брейкаут → быстрый возврат внутрь range",
  },
  {
    key: "range_entry_confirmed",
    label: "Вход после подтверждения (не антиципация)",
    required: true,
  },
  {
    key: "range_stop_outside",
    label: "Стоп за краем диапазона (tight)",
    required: true,
  },
  {
    key: "range_target_midpoint",
    label: "Target 1: midpoint диапазона → BE",
    hint: "После TP1 сразу стоп в безубыток",
  },
  {
    key: "range_target_opposite",
    label: "Target 2: противоположный край value",
  },
];

export const TREND_CHECKLIST: ChecklistItem[] = [
  {
    key: "trend_market_confirmed",
    label: "Рынок imbalanced — value смещается в одну сторону",
    hint: "Чёткий тренд, не range",
    required: true,
  },
  {
    key: "trend_aggressive_move",
    label: "Был агрессивный move в направлении тренда",
    hint: "Liquidation, stops, сильная delta",
    required: true,
  },
  {
    key: "trend_lvn_formed",
    label: "Сформировался LVN (low volume node)",
    hint: "Цена прошла быстро с малым объёмом",
    required: true,
  },
  {
    key: "trend_pullback_to_lvn",
    label: "Pullback вернулся в зону LVN / AOI",
    hint: "Не гонюсь за move — жду retracement",
    required: true,
  },
  {
    key: "trend_aoi_2plus",
    label: "Минимум 2 подтверждения AOI (level + LVN + big trades)",
    required: true,
  },
  {
    key: "trend_opposite_fails",
    label: "Противоположная сторона агрессивна, но цена НЕ идёт дальше",
    hint: "Absorption / trapped против тренда",
  },
  {
    key: "trend_delta_confirms",
    label: "Delta подтверждает контроль трендовой стороны",
  },
  {
    key: "trend_entry_confirmed",
    label: "Вход после подтверждения (reclaim structure / HL or LH)",
    required: true,
  },
  {
    key: "trend_stop_tight",
    label: "Tight stop — инвалидация должна быть быстрой",
    required: true,
  },
  {
    key: "trend_partial_tp",
    label: "Partial TP на структуре + trail остаток",
    hint: "Scale into strength, не в weakness",
  },
];

export const AOI_LEVELS: ChecklistItem[] = [
  { key: "pdh", label: "Previous Day High" },
  { key: "pdl", label: "Previous Day Low" },
  { key: "onh", label: "Overnight High" },
  { key: "onl", label: "Overnight Low" },
  { key: "pdc", label: "Previous Day Close" },
  { key: "orb", label: "Opening Range (ORB)" },
  { key: "vah", label: "Value Area High" },
  { key: "val", label: "Value Area Low" },
  { key: "lvn", label: "Low Volume Node" },
  { key: "bigTrades", label: "Big Trades (75+ NQ / 200+ ES)" },
  { key: "delta", label: "Delta / Aggression" },
  { key: "absorption", label: "Absorption" },
  { key: "trappedTraders", label: "Trapped Traders" },
];

export function getChecklistForModel(model: Model): ChecklistItem[] {
  return model === "RANGE" ? RANGE_CHECKLIST : TREND_CHECKLIST;
}

export function getRequiredChecklistKeys(model: Model): string[] {
  return getChecklistForModel(model)
    .filter((item) => item.required)
    .map((item) => item.key);
}

const ALL_ITEMS = [...RANGE_CHECKLIST, ...TREND_CHECKLIST, ...AOI_LEVELS];

export function getItemLabel(key: string): string {
  return ALL_ITEMS.find((item) => item.key === key)?.label ?? key;
}

export function splitConfirmations(keys: string[], model: Model) {
  const checklistKeys = new Set(getChecklistForModel(model).map((i) => i.key));
  const aoiKeys = new Set(AOI_LEVELS.map((i) => i.key));

  return {
    checklist: keys.filter((k) => checklistKeys.has(k)),
    aoi: keys.filter((k) => aoiKeys.has(k)),
  };
}
