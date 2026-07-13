export interface TradezellaImage {
  id: string;
  src: string;
  title: string;
  titleRu: string;
  description: string;
  tags: string[];
  section: "models" | "big-trades" | "delta" | "absorption" | "lvn" | "range-trade" | "trend-trade";
}

const BASE = "/examples/tradezella";

export const TRADEZELLA_IMAGES: TradezellaImage[] = [
  {
    id: "model-1-range",
    src: `${BASE}/range-setup-1.png`,
    title: "Model 1 — Range (Balanced)",
    titleRu: "Model 1 — Range (Balanced)",
    description:
      "Ручная схема Yush: цена внутри Value Area. Short на VAH после sweep (L) → TP midpoint → TP2 на VAL. Торгуй только края, не середину.",
    tags: ["Model 1", "VAH", "VAL", "Range", "Balanced"],
    section: "models",
  },
  {
    id: "model-2-trend",
    src: `${BASE}/range-setup-2.png`,
    title: "Model 2 — Trend (Imbalanced)",
    titleRu: "Model 2 — Trend (Imbalanced)",
    description:
      "Breakout выше VAH → consolidation → pullback к VAH/LVN → order flow confirmation (круг) → entry (зелёная точка) → targets вверх.",
    tags: ["Model 2", "LVN", "Pullback", "Trend", "Imbalanced"],
    section: "models",
  },
  {
    id: "big-trades-lvn",
    src: `${BASE}/trend-example-1.png`,
    title: "Big Trades + LVN",
    titleRu: "Big Trades + LVN",
    description:
      "Реальный график NQ: downtrend, LVN отмечен чёрным боксом на volume profile. Big trades на ленте: 84, 75, 88 lots (красные круги). Уровни: R, ORL, PL, M, OL, L.",
    tags: ["Big Trades", "LVN", "NQ", "Volume Profile"],
    section: "big-trades",
  },
  {
    id: "big-trades-absorption",
    src: `${BASE}/trend-example-3.png`,
    title: "Big Trade 250 + Delta",
    titleRu: "Big Trade 250 + Delta",
    description:
      "Крупная сделка 250 lots (красный круг) на resistance. Delta profile: -528, -344 на том же уровне. Sellers агрессивны — цена падает.",
    tags: ["Big Trades", "Delta", "250 lots"],
    section: "big-trades",
  },
  {
    id: "delta-profile",
    src: `${BASE}/trend-example-2.png`,
    title: "Delta на Pullback",
    titleRu: "Delta на Pullback",
    description:
      "Pullback в серую зону (OL 25670). Big trades 159 и 80 на resistance. Красные delta bars справа = sellers контролируют. Short setup.",
    tags: ["Delta", "Pullback", "Big Trades 159/80"],
    section: "delta",
  },
  {
    id: "absorption-es",
    src: `${BASE}/range-es-2.png`,
    title: "Absorption — Delta +1091, цена не растёт",
    titleRu: "Absorption — Delta +1091",
    description:
      "ES Range: massive positive delta +1091 на 6967, но цена падает (чёрная свеча). Зелёный круг = big buy absorbed. Классический absorption на resistance.",
    tags: ["Absorption", "Delta +1091", "ES", "Range"],
    section: "absorption",
  },
  {
    id: "absorption-range",
    src: `${BASE}/range-es-1.png`,
    title: "Absorption у Resistance Zone",
    titleRu: "Absorption у Resistance",
    description:
      "Balance zone (чёрный прямоугольник). Много green/red circles у верха — buyers absorbed. Стрелки показывают rejection. Потом breakout с big trade 1744.",
    tags: ["Absorption", "Big Trades", "Range", "Zones"],
    section: "absorption",
  },
  {
    id: "lvn-pullback-entry",
    src: `${BASE}/trend-example-1.png`,
    title: "LVN + Big Trades on Breakdown",
    titleRu: "LVN + Big Trades на breakdown",
    description:
      "LVN отмечен на volume profile (чёрный бокс). Aggressive move вниз, big trades 84/75/88. Жди pullback в LVN — не chase.",
    tags: ["LVN", "Model 2", "Big Trades", "Breakdown"],
    section: "lvn",
  },
  {
    id: "trend-full-move",
    src: `${BASE}/trend-example-1.png`,
    title: "Model 2 — полный move",
    titleRu: "Model 2 — полный сценарий",
    description:
      "Aggressive breakdown ниже уровней → LVN forms → big trades на move → жди pullback (не chase). Источник: Trade Example Model 2.",
    tags: ["Model 2", "Trend", "ONL", "Breakdown"],
    section: "trend-trade",
  },
  {
    id: "range-es-full",
    src: `${BASE}/range-es-3.png`,
    title: "ES Range — полная сессия",
    titleRu: "ES Range — полная сессия",
    description:
      "Три balance zones, volume profile слева, big trades (green/red bubbles), уровни H/OH/C/PL/M/ORH. V-top на highs = trapped buyers.",
    tags: ["Model 1", "ES", "Range", "Zones"],
    section: "range-trade",
  },
  {
    id: "range-es-trapped",
    src: `${BASE}/range-es-1.png`,
    title: "ES Range — Trapped + Breakout",
    titleRu: "ES Range — Trapped Buyers",
    description:
      "Range между зонами. Absorption на верхней зоне (стрелки вниз). Big trade 1744 на breakout. Пример из Trade Example Model 1 ES.",
    tags: ["Trapped Traders", "Range", "ES", "Look above fail"],
    section: "range-trade",
  },
];

export const IMAGE_SECTIONS = [
  { id: "models", title: "Модели — схемы", subtitle: "Model 1 Range и Model 2 Trend (оригинал Yush)" },
  { id: "big-trades", title: "Big Trades", subtitle: "NQ 75+ / ES 200+ lots на ленте" },
  { id: "delta", title: "Delta / Aggression", subtitle: "Кто агрессивен — buyers или sellers" },
  { id: "absorption", title: "Absorption", subtitle: "Heavy delta, цена не движется" },
  { id: "lvn", title: "LVN Model", subtitle: "Low Volume Node + pullback entry" },
  { id: "trend-trade", title: "Trade Example — Model 2 Trend", subtitle: "Реальные графики из playbook" },
  { id: "range-trade", title: "Trade Example — Model 1 Range ES", subtitle: "Реальные графики из playbook" },
] as const;
