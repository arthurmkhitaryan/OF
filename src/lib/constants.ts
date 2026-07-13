export const INSTRUMENTS = ["NQ", "ES"] as const;
export const MODELS = ["RANGE", "TREND"] as const;
export const DIRECTIONS = ["LONG", "SHORT"] as const;
export const ENTRY_TYPES = ["AGGRESSIVE", "CONFIRMATION"] as const;
export const SETUP_QUALITIES = ["A_PLUS", "A", "B", "C"] as const;
export const SESSIONS = ["RTH", "ETH"] as const;

export const CONFIRMATIONS = [
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
] as const;

export const MISTAKE_TAGS = [
  "traded_middle_of_range",
  "no_confirmation",
  "chased_momentum",
  "oversized",
  "moved_stop",
  "let_winner_turn_negative",
  "forced_trade",
  "wrong_model",
  "anticipation",
  "too_many_trades",
] as const;

export const LABELS: Record<string, string> = {
  NQ: "NQ",
  ES: "ES",
  RANGE: "Range (Balanced)",
  TREND: "Trend (Imbalanced)",
  LONG: "Long",
  SHORT: "Short",
  AGGRESSIVE: "Aggressive",
  CONFIRMATION: "Confirmation",
  A_PLUS: "A+",
  A: "A",
  B: "B",
  C: "C",
  RTH: "RTH",
  ETH: "ETH",
  traded_middle_of_range: "Середина диапазона",
  no_confirmation: "Без подтверждения",
  chased_momentum: "Погоня за импульсом",
  oversized: "Переразмер",
  moved_stop: "Двигал стоп",
  let_winner_turn_negative: "Профит ушёл в минус",
  forced_trade: "Форсированная сделка",
  wrong_model: "Неверная модель",
  anticipation: "Антиципация",
  too_many_trades: ">3 сделок за день",
};
