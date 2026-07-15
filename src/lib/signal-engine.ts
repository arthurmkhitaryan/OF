import type {
  GexLevelsLite,
  LiveSignal,
  MarketBar,
  OrderFlowSnapshot,
  VolumeProfileResult,
} from "./market-types";

const EDGE_PCT = 0.15;

export function buildLiveSignal(
  bars: MarketBar[],
  profile: VolumeProfileResult,
  gex: GexLevelsLite | null,
  of?: OrderFlowSnapshot | null
): LiveSignal {
  const ofReasons: string[] = [];
  const missing: string[] = [];

  if (!of || of.source === "none") {
    missing.push(
      "Big / Absorption / Delta — нет ленты Rithmic",
      "Перезапусти npm run bridge (должен загрузить tick history)"
    );
  } else if (of.prints.length === 0) {
    missing.push(
      "Tape пустой — ждут Last Trades / tick history с Rithmic",
      "Проверь agreements в R|Trader Test и print_counts в /health"
    );
  } else if (of.events.length === 0) {
    ofReasons.push(
      `Δ cum ${of.cumDelta > 0 ? "+" : ""}${Math.round(of.cumDelta)} (${of.source})`
    );
    missing.push("Events ещё копятся (нужен объём на ленте)");
  } else {
    const big = of.events.filter((e) => e.type === "BIG_TRADE").length;
    const abs = of.events.filter((e) => e.type === "ABSORPTION").length;
    const trap = of.events.filter((e) => e.type === "TRAPPED").length;
    if (big) ofReasons.push(`Big trades: ${big}`);
    if (abs) ofReasons.push(`Absorption: ${abs}`);
    if (trap) ofReasons.push(`Trapped: ${trap}`);
    ofReasons.push(
      `Δ cum ${of.cumDelta > 0 ? "+" : ""}${Math.round(of.cumDelta)} (${of.source})`
    );
    if (of.source === "demo") {
      missing.push("OF demo — включи bridge для реального tape");
    }
  }

  if (!bars.length || profile.totalVolume <= 0) {
    return {
      status: "NO_TRADE",
      model: null,
      direction: null,
      quality: null,
      entryZone: null,
      stop: null,
      targets: [],
      reasons: ["Недостаточно данных для анализа"],
      missing,
      summary: "NO TRADE — нет рыночных данных",
    };
  }

  const spot = bars[bars.length - 1].close;
  const vaWidth = Math.max(profile.vah - profile.val, 1);
  const mid = (profile.vah + profile.val) / 2;
  const edgeBand = vaWidth * EDGE_PCT;

  const nearVah = Math.abs(spot - profile.vah) <= edgeBand;
  const nearVal = Math.abs(spot - profile.val) <= edgeBand;
  const inMid = spot < profile.vah - edgeBand && spot > profile.val + edgeBand;

  const gexNear =
    !!gex &&
    ((gex.callWall != null && Math.abs(spot - gex.callWall) / spot < 0.008) ||
      (gex.putWall != null && Math.abs(spot - gex.putWall) / spot < 0.008) ||
      (gex.zeroGamma != null && Math.abs(spot - gex.zeroGamma) / spot < 0.008));

  const nearLvn = profile.lvn.some((l) => Math.abs(spot - l) <= edgeBand * 1.2);

  if (profile.regime === "BALANCED") {
    if (inMid) {
      return {
        status: "NO_TRADE",
        model: "RANGE",
        direction: null,
        quality: null,
        entryZone: null,
        stop: null,
        targets: [],
        reasons: [
          "Рынок balanced (Model 1)",
          "Цена в середине Value Area — NO TRADE",
          `VAL ${profile.val} · POC ${profile.poc} · VAH ${profile.vah}`,
        ],
        missing,
        summary: "NO TRADE — mid-range. Жди VAH или VAL.",
      };
    }

    if (nearVah || nearVal) {
      const direction = nearVah ? "SHORT" : "LONG";
      const entryZone = nearVah ? profile.vah : profile.val;
      const stop = nearVah
        ? profile.vah + vaWidth * 0.15
        : profile.val - vaWidth * 0.15;
      const targets = [mid, nearVah ? profile.val : profile.vah];
      const reasons = [
        "Рынок balanced → Model 1 Range",
        nearVah ? "Цена у VAH — short bias" : "Цена у VAL — long bias",
        `VA: ${profile.val} – ${profile.vah} (POC ${profile.poc})`,
        ...ofReasons,
      ];

      let qualityScore = 1;
      if (gexNear) {
        qualityScore += 1;
        reasons.push("Рядом GEX уровень (wall / flip)");
      }
      if (nearLvn) {
        qualityScore += 1;
        reasons.push("Рядом LVN");
      }
      if (of && of.source === "bridge" && of.events.some((e) => e.type === "ABSORPTION" || e.type === "BIG_TRADE")) {
        qualityScore += 1;
        reasons.push("OF confirm (bridge)");
      }

      const quality = qualityScore >= 3 ? "A" : qualityScore >= 2 ? "B" : "C";

      return {
        status: quality === "C" ? "WATCH" : "SIGNAL",
        model: "RANGE",
        direction,
        quality,
        entryZone,
        stop: round2(stop),
        targets: targets.map(round2),
        reasons,
        missing,
        summary: `${quality === "C" ? "WATCH" : "SIGNAL"} Model 1 ${direction} @ ${entryZone} (quality ${quality})`,
      };
    }

    return {
      status: "WATCH",
      model: "RANGE",
      direction: null,
      quality: null,
      entryZone: null,
      stop: null,
      targets: [],
      reasons: [
        "Рынок balanced → Model 1",
        "Ждём подхода к VAH / VAL",
        `Spot ${round2(spot)} · VA ${profile.val}–${profile.vah}`,
      ],
      missing,
      summary: "WATCH — Range day, жди край value",
    };
  }

  if (profile.regime === "IMBALANCED") {
    const bias = profile.trendBias;
    if (bias === "FLAT") {
      return {
        status: "WATCH",
        model: "TREND",
        direction: null,
        quality: null,
        entryZone: null,
        stop: null,
        targets: [],
        reasons: [
          "Value смещается (imbalanced), но bias пока FLAT",
          "Ждём pullback в LVN / prior VA",
        ],
        missing,
        summary: "WATCH — Trend setup формируется",
      };
    }

    const direction = bias === "UP" ? "LONG" : "SHORT";
    const pullbackLevel =
      profile.lvn[0] ?? (bias === "UP" ? profile.val : profile.vah);
    const atPullback = Math.abs(spot - pullbackLevel) <= edgeBand * 1.5;

    if (!atPullback) {
      return {
        status: "WATCH",
        model: "TREND",
        direction,
        quality: null,
        entryZone: pullbackLevel,
        stop: null,
        targets: [],
        reasons: [
          `Рынок imbalanced → Model 2 ${direction}`,
          `Ждём pullback к LVN/VA ~ ${pullbackLevel}`,
          `Spot ${round2(spot)} — не фейдить тренд`,
        ],
        missing,
        summary: `WATCH Model 2 ${direction} — wait pullback @ ${pullbackLevel}`,
      };
    }

    const stop =
      direction === "LONG"
        ? pullbackLevel - vaWidth * 0.2
        : pullbackLevel + vaWidth * 0.2;
    const targets =
      direction === "LONG"
        ? [profile.vah, spot + vaWidth]
        : [profile.val, spot - vaWidth];

    const reasons = [
      `Imbalanced ${bias} → Model 2 ${direction}`,
      `Pullback в зону ${pullbackLevel}`,
      ...(of && of.events.length
        ? ofReasons
        : ["OF confirmation ещё нет — качество ограничено"]),
    ];
    if (gexNear) reasons.push("GEX рядом усиливает уровень");

    return {
      status: "SIGNAL",
      model: "TREND",
      direction,
      quality: gexNear || nearLvn || (of && of.events.length > 0) ? "B" : "C",
      entryZone: pullbackLevel,
      stop: round2(stop),
      targets: targets.map(round2),
      reasons,
      missing,
      summary: `SIGNAL Model 2 ${direction} @ ${pullbackLevel}${of?.source === "demo" ? " (OF demo)" : ""}`,
    };
  }

  return {
    status: "WATCH",
    model: null,
    direction: null,
    quality: null,
    entryZone: null,
    stop: null,
    targets: [],
    reasons: [
      "Режим рынка неясен (не чёткий balanced/imbalanced)",
      "Первые 30–60 мин RTH — определи condition, потом модель",
    ],
    missing,
    summary: "WATCH — определяем balanced vs imbalanced",
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
