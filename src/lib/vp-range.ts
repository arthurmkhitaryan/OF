import type { LiveInstrument, MarketBar } from "./market-types";

export type VpRangeMode =
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "session"
  | "visible"
  | "all"
  | "custom";

export type VpCustomRange = { from: number; to: number } | null;

export type VpVisibleRange = { from: number; to: number } | null;

const HOURS: Record<"1h" | "2h" | "4h" | "6h", number> = {
  "1h": 1,
  "2h": 2,
  "4h": 4,
  "6h": 6,
};

/** CME equity-index RTH: 09:30–16:00 America/New_York */
export function rthSessionBounds(nowSec = Date.now() / 1000): {
  from: number;
  to: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(nowSec * 1000));

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const y = get("year");
  const m = get("month");
  const d = get("day");
  const hour = get("hour");
  const minute = get("minute");

  // Find NY offset at this instant (handles DST)
  const nyOffsetMin = nyUtcOffsetMinutes(nowSec);
  const localAsUtc = Date.UTC(y, m - 1, d, 9, 30, 0) - nyOffsetMin * 60_000;
  let from = Math.floor(localAsUtc / 1000);
  let to = from + (6 * 60 + 30) * 60; // 09:30 → 16:00

  // Before RTH open → previous day's RTH
  const nyMinutes = hour * 60 + minute;
  if (nyMinutes < 9 * 60 + 30) {
    from -= 24 * 3600;
    to -= 24 * 3600;
  } else if (nyMinutes >= 16 * 60) {
    // after close: still show today's full RTH
    to = Math.min(to, Math.floor(nowSec));
  } else {
    to = Math.floor(nowSec);
  }

  return { from, to };
}

function nyUtcOffsetMinutes(nowSec: number): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  });
  const tz =
    formatter
      .formatToParts(new Date(nowSec * 1000))
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT-4";
  const m = tz.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!m) return -4 * 60;
  const sign = m[1] === "-" ? -1 : 1;
  const h = Number(m[2]);
  const min = Number(m[3] ?? 0);
  return sign * (h * 60 + min);
}

export function sliceBarsForVp(
  bars: MarketBar[],
  mode: VpRangeMode,
  opts?: {
    custom?: VpCustomRange;
    visible?: VpVisibleRange;
  }
): MarketBar[] {
  if (!bars.length) return bars;

  if (mode === "all") return bars;

  if (mode === "session") {
    const { from, to } = rthSessionBounds(bars[bars.length - 1]!.time);
    return bars.filter((b) => b.time >= from && b.time <= to);
  }

  if (mode === "visible") {
    const v = opts?.visible;
    if (!v) return recentSlice(bars, 2);
    return bars.filter((b) => b.time >= v.from && b.time <= v.to);
  }

  if (mode === "custom") {
    const c = opts?.custom;
    if (!c || c.to <= c.from) return recentSlice(bars, 2);
    return bars.filter((b) => b.time >= c.from && b.time <= c.to);
  }

  return recentSlice(bars, HOURS[mode]);
}

function recentSlice(bars: MarketBar[], hours: number): MarketBar[] {
  const cut = bars[bars.length - 1]!.time - hours * 3600;
  const slice = bars.filter((b) => b.time >= cut);
  return slice.length >= 8 ? slice : bars.slice(-Math.max(30, hours * 60));
}

export function vpBinSize(instrument: LiveInstrument): number {
  return instrument === "NQ" ? 5 : 2.5;
}

export function vpRangeLabel(
  mode: VpRangeMode,
  opts?: { custom?: VpCustomRange; visible?: VpVisibleRange; barCount?: number }
): string {
  const n = opts?.barCount != null ? ` · ${opts.barCount} bars` : "";
  if (mode === "session") return `RTH session${n}`;
  if (mode === "visible") return `Visible chart${n}`;
  if (mode === "all") return `All loaded${n}`;
  if (mode === "custom") {
    const c = opts?.custom;
    if (!c) return `Custom (pick range)${n}`;
    const fmt = (t: number) =>
      new Date(t * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    return `${fmt(c.from)} – ${fmt(c.to)}${n}`;
  }
  return `${mode}${n}`;
}

export const VP_RANGE_PRESETS: { mode: VpRangeMode; label: string }[] = [
  { mode: "1h", label: "1h" },
  { mode: "2h", label: "2h" },
  { mode: "4h", label: "4h" },
  { mode: "6h", label: "6h" },
  { mode: "session", label: "RTH" },
  { mode: "visible", label: "Visible" },
  { mode: "all", label: "All" },
  { mode: "custom", label: "Custom" },
];
