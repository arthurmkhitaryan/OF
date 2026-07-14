import type { MarketBar, VolumeBin, VolumeProfileResult } from "./market-types";

export function computeVolumeProfile(
  bars: MarketBar[],
  binSize = 5
): VolumeProfileResult {
  if (bars.length === 0) {
    return {
      bins: [],
      poc: 0,
      vah: 0,
      val: 0,
      lvn: [],
      hvn: [],
      totalVolume: 0,
      vaShift: 0,
      regime: "UNCLEAR",
      trendBias: "FLAT",
    };
  }

  const map = new Map<number, number>();
  let totalVolume = 0;

  for (const bar of bars) {
    const lowBin = Math.floor(bar.low / binSize) * binSize;
    const highBin = Math.floor(bar.high / binSize) * binSize;
    const steps = Math.max(1, Math.round((highBin - lowBin) / binSize) + 1);
    const per = bar.volume / steps;
    for (let p = lowBin; p <= highBin; p += binSize) {
      map.set(p, (map.get(p) ?? 0) + per);
    }
    const closeBin = Math.floor(bar.close / binSize) * binSize;
    map.set(closeBin, (map.get(closeBin) ?? 0) + bar.volume * 0.15);
    totalVolume += bar.volume;
  }

  const bins: VolumeBin[] = Array.from(map.entries())
    .map(([price, volume]) => ({ price, volume }))
    .sort((a, b) => a.price - b.price);

  if (!bins.length) {
    const last = bars[bars.length - 1].close;
    return {
      bins: [],
      poc: last,
      vah: last,
      val: last,
      lvn: [],
      hvn: [],
      totalVolume: 0,
      vaShift: 0,
      regime: "UNCLEAR",
      trendBias: "FLAT",
    };
  }

  const pocBin = bins.reduce((a, b) => (b.volume > a.volume ? b : a));
  const poc = pocBin.price;

  const target = totalVolume * 0.7;
  let lo = bins.findIndex((b) => b.price === poc);
  let hi = lo;
  let covered = bins[lo]?.volume ?? 0;
  while (covered < target && (lo > 0 || hi < bins.length - 1)) {
    const nextLo = lo > 0 ? bins[lo - 1].volume : -1;
    const nextHi = hi < bins.length - 1 ? bins[hi + 1].volume : -1;
    if (nextHi >= nextLo) {
      hi += 1;
      covered += bins[hi].volume;
    } else {
      lo -= 1;
      covered += bins[lo].volume;
    }
  }

  const val = bins[lo].price;
  const vah = bins[hi].price;

  const { lvn, hvn } = findVolumeNodes(bins, pocBin.volume, binSize);

  const mid = Math.floor(bars.length / 2);
  const early = computeSimpleVa(bars.slice(0, mid), binSize);
  const late = computeSimpleVa(bars.slice(mid), binSize);
  const vaShift = late.mid - early.mid;
  const rangeWidth = Math.max(vah - val, binSize);
  const shiftRatio = Math.abs(vaShift) / rangeWidth;

  const last = bars[bars.length - 1].close;
  const first = bars[0].close;
  const netMove = last - first;
  const trendBias: VolumeProfileResult["trendBias"] =
    Math.abs(netMove) < rangeWidth * 0.35
      ? "FLAT"
      : netMove > 0
        ? "UP"
        : "DOWN";

  let regime: VolumeProfileResult["regime"] = "UNCLEAR";
  if (shiftRatio < 0.35 && trendBias === "FLAT") regime = "BALANCED";
  else if (shiftRatio >= 0.45 || (trendBias !== "FLAT" && shiftRatio >= 0.3))
    regime = "IMBALANCED";
  else if (shiftRatio < 0.25) regime = "BALANCED";
  else regime = "UNCLEAR";

  return {
    bins,
    poc,
    vah,
    val,
    lvn,
    hvn,
    totalVolume,
    vaShift,
    regime,
    trendBias,
  };
}

/**
 * LVN = volume valleys with real prominence (not every tiny wiggle).
 * HVN = local peaks with enough volume vs POC.
 */
function findVolumeNodes(bins: VolumeBin[], pocVol: number, binSize: number) {
  type Cand = { index: number; price: number; volume: number; score: number };
  const lvns: Cand[] = [];
  const hvns: Cand[] = [];
  const window = Math.max(3, Math.min(12, Math.floor(bins.length / 8)));

  for (let i = 1; i < bins.length - 1; i++) {
    const v = bins[i].volume;
    const left = bins[i - 1].volume;
    const right = bins[i + 1].volume;

    if (v > left && v > right && v >= pocVol * 0.55) {
      hvns.push({ index: i, price: bins[i].price, volume: v, score: v });
    }

    // local trough
    if (!(v <= left && v <= right)) continue;
    if (v > pocVol * 0.55) continue;

    let maxLeft = left;
    let maxRight = right;
    for (let j = i - 1; j >= Math.max(0, i - window); j--) {
      maxLeft = Math.max(maxLeft, bins[j].volume);
    }
    for (let j = i + 1; j <= Math.min(bins.length - 1, i + window); j++) {
      maxRight = Math.max(maxRight, bins[j].volume);
    }

    const prominence = Math.min(maxLeft, maxRight) - v;
    // must be a clear "gap" — neighbors significantly higher than the trough
    if (prominence < pocVol * 0.18) continue;
    if (v / Math.max(maxLeft, maxRight, 1) > 0.65) continue;

    lvns.push({
      index: i,
      price: bins[i].price,
      volume: v,
      score: prominence / (v + 1),
    });
  }

  lvns.sort((a, b) => b.score - a.score);
  hvns.sort((a, b) => b.score - a.score);

  const minGap = binSize * 2.5;
  return {
    lvn: pickSpread(lvns, 4, minGap),
    hvn: pickSpread(hvns, 4, minGap),
  };
}

function pickSpread(
  cands: { price: number; score: number }[],
  limit: number,
  minGap: number
): number[] {
  const out: number[] = [];
  for (const c of cands) {
    if (out.some((p) => Math.abs(p - c.price) < minGap)) continue;
    out.push(c.price);
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => a - b);
}

function computeSimpleVa(bars: MarketBar[], binSize: number) {
  if (!bars.length) return { mid: 0 };
  const map = new Map<number, number>();
  let total = 0;
  for (const b of bars) {
    const bin = Math.floor(b.close / binSize) * binSize;
    map.set(bin, (map.get(bin) ?? 0) + b.volume);
    total += b.volume;
  }
  const bins = Array.from(map.entries())
    .map(([price, volume]) => ({ price, volume }))
    .sort((a, b) => a.price - b.price);
  if (!bins.length) return { mid: bars[bars.length - 1].close };
  const poc = bins.reduce((a, b) => (b.volume > a.volume ? b : a));
  let lo = bins.findIndex((b) => b.price === poc.price);
  let hi = lo;
  let covered = poc.volume;
  const target = total * 0.7;
  while (covered < target && (lo > 0 || hi < bins.length - 1)) {
    const nextLo = lo > 0 ? bins[lo - 1].volume : -1;
    const nextHi = hi < bins.length - 1 ? bins[hi + 1].volume : -1;
    if (nextHi >= nextLo) {
      hi += 1;
      covered += bins[hi].volume;
    } else {
      lo -= 1;
      covered += bins[lo].volume;
    }
  }
  return { mid: (bins[lo].price + bins[hi].price) / 2 };
}
