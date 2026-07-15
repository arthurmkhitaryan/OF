"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  createSeriesMarkers,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
  type Time,
} from "lightweight-charts";
import type { OrderFlowEvent, TickPrint } from "@/lib/market-types";
import { pickChartMarkers } from "@/lib/chart-markers";

interface Props {
  prints: TickPrint[];
  events: OrderFlowEvent[];
  entryZone?: number | null;
  stopPrice?: number | null;
  takePrice?: number | null;
  bigOnly?: boolean;
  followLive?: boolean;
  onFollowLiveChange?: (follow: boolean) => void;
  /** Forced last trade price (updates point even within same second) */
  livePrice?: number | null;
}

/**
 * Price path tick-by-tick. LWC needs unique unix-second keys, so same-second
 * trades update the last point's value (price visibly jumps on each print).
 */
export function TickChart({
  prints,
  events,
  entryZone,
  stopPrice,
  takePrice,
  bigOnly = false,
  followLive = true,
  onFollowLiveChange,
  livePrice = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const fittedRef = useRef(false);
  const followRef = useRef(followLive);
  const programmaticRef = useRef(false);
  const onFollowRef = useRef(onFollowLiveChange);
  const lastSecRef = useRef<number | null>(null);
  const lastValRef = useRef<number | null>(null);

  followRef.current = followLive;
  onFollowRef.current = onFollowLiveChange;

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
      rightPriceScale: {
        borderColor: "#27272a",
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "#27272a",
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 8,
        shiftVisibleRangeOnNewBar: true,
        barSpacing: 3,
      },
      width: containerRef.current.clientWidth,
      height: 480,
    });
    const series = chart.addSeries(LineSeries, {
      color: "#38bdf8",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: true,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);
    fittedRef.current = false;
    lastSecRef.current = null;
    lastValRef.current = null;

    let downX = 0;
    let downY = 0;
    const unlockPan = () => {
      if (programmaticRef.current) return;
      if (followRef.current) onFollowRef.current?.(false);
    };
    const el = containerRef.current;
    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons === 0) return;
      if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) {
        unlockPan();
      }
    };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("wheel", unlockPan, { passive: true });

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
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // Full rebuild when print history changes a lot
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || !prints.length) return;

    const bySec = new Map<number, number>();
    for (const p of prints) {
      const t = Math.floor(p.time);
      bySec.set(t, p.price);
    }
    const data = Array.from(bySec.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([time, value]) => ({ time: time as Time, value }));

    if (!data.length) return;
    series.setData(data);
    lastSecRef.current = data[data.length - 1]!.time as number;
    lastValRef.current = data[data.length - 1]!.value;

    if (!fittedRef.current) {
      programmaticRef.current = true;
      const from = Math.max(0, data.length - 180);
      chart.timeScale().setVisibleLogicalRange({
        from,
        to: data.length + 4,
      });
      fittedRef.current = true;
      requestAnimationFrame(() => {
        programmaticRef.current = false;
      });
    } else if (followLive) {
      programmaticRef.current = true;
      chart.timeScale().scrollToRealTime();
      requestAnimationFrame(() => {
        programmaticRef.current = false;
      });
    }

    for (const line of linesRef.current) series.removePriceLine(line);
    linesRef.current = [];
    const add = (price: number, color: string, title: string) => {
      if (!Number.isFinite(price)) return;
      linesRef.current.push(
        series.createPriceLine({
          price,
          color,
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title,
        })
      );
    };
    if (entryZone != null) add(entryZone, "#f472b6", "Entry");
    if (stopPrice != null) add(stopPrice, "#ef4444", "Stop");
    if (takePrice != null) add(takePrice, "#22c55e", "Take");

    const markers = pickChartMarkers(events, {
      max: 10,
      lookbackSec: 2 * 60 * 60,
      types: bigOnly ? ["BIG_TRADE"] : ["BIG_TRADE", "ABSORPTION", "TRAPPED"],
    }).map((e) => ({
      time: Math.floor(e.time) as Time,
      position: (e.side === "BUY" ? "belowBar" : "aboveBar") as
        | "belowBar"
        | "aboveBar",
      color:
        e.type === "BIG_TRADE"
          ? "#fb923c"
          : e.type === "ABSORPTION"
            ? "#e879f9"
            : "#facc15",
      shape: (e.side === "BUY" ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
      text:
        e.type === "BIG_TRADE"
          ? `${e.size ?? ""}`
          : e.type === "ABSORPTION"
            ? "ABS"
            : "TRP",
    }));
    markersRef.current?.setMarkers(markers);
  }, [prints, events, entryZone, stopPrice, takePrice, bigOnly, followLive]);

  // Every live trade / BBO: move last price point immediately
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (
      !series ||
      !chart ||
      livePrice == null ||
      !Number.isFinite(livePrice)
    ) {
      return;
    }
    if (lastValRef.current === livePrice) return;

    const sec = Math.floor(Date.now() / 1000);
    try {
      if (lastSecRef.current != null && sec === lastSecRef.current) {
        series.update({ time: sec as Time, value: livePrice });
      } else if (lastSecRef.current != null && sec > lastSecRef.current) {
        series.update({ time: sec as Time, value: livePrice });
        lastSecRef.current = sec;
      } else if (lastSecRef.current == null) {
        series.update({ time: sec as Time, value: livePrice });
        lastSecRef.current = sec;
      } else {
        // clock skew vs print time — still bump value on last sec
        series.update({
          time: lastSecRef.current as Time,
          value: livePrice,
        });
      }
      lastValRef.current = livePrice;
    } catch {
      try {
        series.update({ time: sec as Time, value: livePrice });
        lastSecRef.current = sec;
        lastValRef.current = livePrice;
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

  const last = prints[prints.length - 1];

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 text-[10px] text-zinc-500">
        <span>Tick chart · price moves on every print</span>
        <span className="font-mono text-zinc-300">
          {livePrice != null
            ? livePrice.toFixed(2)
            : last
              ? last.price.toFixed(2)
              : "—"}{" "}
          · {prints.length} ticks
        </span>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
