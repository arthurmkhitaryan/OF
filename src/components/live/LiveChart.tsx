"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
  type LogicalRange,
  type Time,
} from "lightweight-charts";
import type {
  GexLevelsLite,
  MarketBar,
  OrderFlowEvent,
  TickPrint,
  VolumeProfileResult,
} from "@/lib/market-types";
import { ChartSideOverlaysPrimitive } from "@/lib/volume-profile-primitive";
import { pickChartMarkers } from "@/lib/chart-markers";

export type ChartLayers = {
  vp: boolean;
  delta: boolean;
  lvn: boolean;
  gex: boolean;
  ofMarkers: boolean;
  ofBigOnly: boolean;
  levels: boolean;
};

interface Props {
  bars: MarketBar[];
  profile: VolumeProfileResult | null;
  prints?: TickPrint[];
  gex: GexLevelsLite | null;
  orderflow: OrderFlowEvent[];
  entryZone?: number | null;
  stopPrice?: number | null;
  takePrice?: number | null;
  layers: ChartLayers;
  /** When false (user panned), do not auto-scroll right. */
  followLive: boolean;
  onFollowLiveChange?: (follow: boolean) => void;
  /** Immediate last price from Rithmic WS (ms tape) */
  livePrice?: number | null;
  /** Notify parent of visible time range (unix sec) for VP "visible" mode */
  onVisibleTimeRangeChange?: (range: { from: number; to: number } | null) => void;
  /** When set, next click(s) on the chart pick custom VP range endpoints */
  customPickActive?: boolean;
  onCustomTimePicked?: (time: number) => void;
  /** Highlight custom VP range on the time scale */
  highlightRange?: { from: number; to: number } | null;
}

export function LiveChart({
  bars,
  profile,
  prints = [],
  gex,
  orderflow,
  entryZone,
  stopPrice,
  takePrice,
  layers,
  followLive,
  onFollowLiveChange,
  livePrice = null,
  onVisibleTimeRangeChange,
  customPickActive = false,
  onCustomTimePicked,
  highlightRange = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const overlayRef = useRef<ChartSideOverlaysPrimitive | null>(null);

  const followRef = useRef(followLive);
  const fittedRef = useRef(false);
  const lastBarsRef = useRef<MarketBar[]>([]);
  const programmaticRef = useRef(false);
  const onFollowRef = useRef(onFollowLiveChange);
  const onVisibleRef = useRef(onVisibleTimeRangeChange);
  const customPickRef = useRef(customPickActive);
  const onCustomPickRef = useRef(onCustomTimePicked);

  followRef.current = followLive;
  onFollowRef.current = onFollowLiveChange;
  onVisibleRef.current = onVisibleTimeRangeChange;
  customPickRef.current = customPickActive;
  onCustomPickRef.current = onCustomTimePicked;

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#09090b" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#18181b" },
        horzLines: { color: "#18181b" },
      },
      rightPriceScale: { borderColor: "#27272a" },
      timeScale: {
        borderColor: "#27272a",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        shiftVisibleRangeOnNewBar: false,
        barSpacing: 10,
        minBarSpacing: 4,
      },
      crosshair: { mode: 1 },
      width: containerRef.current.clientWidth,
      height: 520,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#f87171",
      borderVisible: false,
      wickUpColor: "#34d399",
      wickDownColor: "#f87171",
      priceLineVisible: true,
      lastValueVisible: true,
    });
    series.priceScale().applyOptions({
      autoScale: true,
      scaleMargins: { top: 0.08, bottom: 0.12 },
    });

    const overlay = new ChartSideOverlaysPrimitive(0.28, 0.28);
    series.attachPrimitive(overlay);

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);
    overlayRef.current = overlay;
    fittedRef.current = false;
    lastBarsRef.current = [];

    const unlockPan = () => {
      if (programmaticRef.current) return;
      if (followRef.current) onFollowRef.current?.(false);
    };

    const el = containerRef.current;
    // Only intentional pan/zoom — not a mere click (that was freezing “follow”)
    let downX = 0;
    let downY = 0;
    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons === 0) return;
      const dx = Math.abs(e.clientX - downX);
      const dy = Math.abs(e.clientY - downY);
      if (dx > 6 || dy > 6) unlockPan();
    };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("wheel", unlockPan, { passive: true });

    const onRange = (range: LogicalRange | null) => {
      if (!range) return;
      const dataLen = lastBarsRef.current.length;
      if (!dataLen) return;

      const fromIdx = Math.max(0, Math.floor(range.from as number));
      const toIdx = Math.min(dataLen - 1, Math.ceil(range.to as number));
      const fromBar = lastBarsRef.current[fromIdx];
      const toBar = lastBarsRef.current[toIdx];
      if (fromBar && toBar) {
        onVisibleRef.current?.({ from: fromBar.time, to: toBar.time });
      }

      if (programmaticRef.current) return;
      const atRight = (range.to as number) >= dataLen - 1.5;
      if (!atRight && followRef.current) onFollowRef.current?.(false);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

    const onClick = (param: { time?: unknown }) => {
      if (!customPickRef.current || param.time == null) return;
      const t = typeof param.time === "number" ? param.time : null;
      if (t != null) onCustomPickRef.current?.(t);
    };
    chart.subscribeClick(onClick);

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("wheel", unlockPan);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      chart.unsubscribeClick(onClick);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // Bars: update data WITHOUT yanking viewport when user panned
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || !bars.length) return;

    const prev = lastBarsRef.current;
    const data = bars.map((b) => ({
      time: b.time as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));

    const sameStructure =
      prev.length > 0 &&
      prev.length === bars.length &&
      prev[0].time === bars[0].time &&
      prev[prev.length - 1].time === bars[bars.length - 1].time;

    const onlyLastTick =
      sameStructure &&
      prev.slice(0, -1).every((b, i) => b.time === bars[i].time);

    const appendedOne =
      prev.length > 0 &&
      bars.length === prev.length + 1 &&
      prev[0].time === bars[0].time &&
      prev[prev.length - 1].time === bars[bars.length - 2].time;

    if (onlyLastTick || appendedOne) {
      const last = bars[bars.length - 1]!;
      try {
        series.update({
          time: last.time as Time,
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
        });
      } catch {
        series.setData(data);
      }
    } else {
      series.setData(data);
    }

    lastBarsRef.current = bars.map((b) => ({ ...b }));

    // First paint only — then leave the user alone unless followLive
    if (!fittedRef.current) {
      programmaticRef.current = true;
      const from = Math.max(0, bars.length - 90);
      chart.timeScale().setVisibleLogicalRange({
        from,
        to: bars.length + 6,
      } as LogicalRange);
      fittedRef.current = true;
      const fromBar = bars[from];
      const toBar = bars[bars.length - 1];
      if (fromBar && toBar) {
        onVisibleRef.current?.({ from: fromBar.time, to: toBar.time });
      }
      requestAnimationFrame(() => {
        programmaticRef.current = false;
      });
      return;
    }

    if (followLive) {
      programmaticRef.current = true;
      chart.timeScale().scrollToRealTime();
      requestAnimationFrame(() => {
        programmaticRef.current = false;
      });
    }
    // if !followLive → do not touch timeScale at all
  }, [bars, followLive]);

  // Fast path: WS mid/trade price → last candle (no full re-setData)
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || livePrice == null || !Number.isFinite(livePrice)) {
      return;
    }
    const prev = lastBarsRef.current;
    if (!prev.length) return;
    const last = prev[prev.length - 1]!;
    const nowSec = Math.floor(Date.now() / 1000);
    const minute = nowSec - (nowSec % 60);

    if (minute > last.time) {
      const next = {
        time: minute,
        open: last.close,
        high: Math.max(last.close, livePrice),
        low: Math.min(last.close, livePrice),
        close: livePrice,
        volume: 0,
      };
      try {
        series.update({
          time: next.time as Time,
          open: next.open,
          high: next.high,
          low: next.low,
          close: next.close,
        });
        lastBarsRef.current = [...prev, next];
      } catch {
        /* ignore */
      }
    } else {
      const updated = {
        ...last,
        high: Math.max(last.high, livePrice),
        low: Math.min(last.low, livePrice),
        close: livePrice,
      };
      try {
        series.update({
          time: updated.time as Time,
          open: updated.open,
          high: updated.high,
          low: updated.low,
          close: updated.close,
        });
        lastBarsRef.current = [...prev.slice(0, -1), updated];
      } catch {
        /* ignore */
      }
    }

    if (followLive) {
      programmaticRef.current = true;
      chart.timeScale().scrollToRealTime();
      requestAnimationFrame(() => {
        programmaticRef.current = false;
      });
    }
  }, [livePrice, followLive]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    for (const line of linesRef.current) series.removePriceLine(line);
    linesRef.current = [];

    function addLine(
      price: number,
      color: string,
      title: string,
      style: number = 2,
      width: 1 | 2 | 3 | 4 = 1
    ) {
      if (!Number.isFinite(price)) return;
      linesRef.current.push(
        series!.createPriceLine({
          price,
          color,
          lineWidth: width,
          lineStyle: style,
          axisLabelVisible: true,
          title,
        })
      );
    }

    if (profile && layers.vp) {
      addLine(profile.vah, "#60a5fa", "VAH", 2, 2);
      addLine(profile.val, "#60a5fa", "VAL", 2, 2);
      addLine(profile.poc, "#c4b5fd", "POC", 0, 2);
      if (layers.lvn) {
        for (const l of profile.lvn.slice(0, 2)) {
          addLine(l, "#fb923c", "LVN", 1, 1);
        }
      }
    }

    if (layers.gex && gex) {
      if (gex.callWall != null) addLine(gex.callWall, "#34d399", "Call");
      if (gex.putWall != null) addLine(gex.putWall, "#f87171", "Put");
      if (gex.zeroGamma != null) addLine(gex.zeroGamma, "#eab308", "Flip", 3);
    }

    if (layers.levels) {
      if (entryZone != null) addLine(entryZone, "#f472b6", "Entry", 0, 2);
      if (stopPrice != null) addLine(stopPrice, "#ef4444", "Stop", 0, 2);
      if (takePrice != null) addLine(takePrice, "#22c55e", "Take", 0, 2);
    }

    overlayRef.current?.setData({
      profile: layers.vp ? profile : null,
      prints,
      showVp: layers.vp,
      showLvn: layers.lvn,
      showDelta: layers.delta,
    });

    const ofMarks = layers.ofMarkers
      ? pickChartMarkers(orderflow, {
          max: 14,
          lookbackSec: 6 * 60 * 60,
          types: layers.ofBigOnly
            ? ["BIG_TRADE"]
            : ["BIG_TRADE", "ABSORPTION", "TRAPPED"],
        }).map((e) => ({
          time: (Math.floor(e.time / 60) * 60) as Time,
          position: (e.side === "BUY" ? "belowBar" : "aboveBar") as
            | "belowBar"
            | "aboveBar",
          color:
            e.type === "BIG_TRADE"
              ? "#fb923c"
              : e.type === "ABSORPTION"
                ? "#e879f9"
                : "#facc15",
          shape: (e.side === "BUY" ? "arrowUp" : "arrowDown") as
            | "arrowUp"
            | "arrowDown",
          text:
            e.type === "BIG_TRADE"
              ? String(e.size ?? "")
              : e.type === "ABSORPTION"
                ? "ABS"
                : "TRP",
        }))
      : [];

    const rangeMarks =
      highlightRange && highlightRange.to > highlightRange.from
        ? [
            {
              time: (Math.floor(highlightRange.from / 60) * 60) as Time,
              position: "aboveBar" as const,
              color: "#38bdf8",
              shape: "circle" as const,
              text: "VP>",
            },
            {
              time: (Math.floor(highlightRange.to / 60) * 60) as Time,
              position: "aboveBar" as const,
              color: "#38bdf8",
              shape: "circle" as const,
              text: "<VP",
            },
          ]
        : [];

    markersRef.current?.setMarkers([...ofMarks, ...rangeMarks]);
  }, [
    profile,
    prints,
    gex,
    orderflow,
    entryZone,
    stopPrice,
    takePrice,
    layers,
    highlightRange,
  ]);

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-zinc-950 ${
        customPickActive ? "border-sky-500 ring-1 ring-sky-500/40" : "border-zinc-800"
      }`}
    >
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
