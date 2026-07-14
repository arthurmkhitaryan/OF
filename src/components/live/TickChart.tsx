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
}

export function TickChart({
  prints,
  events,
  entryZone,
  stopPrice,
  takePrice,
  bigOnly = true,
  followLive = true,
  onFollowLiveChange,
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
  const wrapRef = useRef<HTMLDivElement>(null);

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
      rightPriceScale: { borderColor: "#27272a" },
      timeScale: {
        borderColor: "#27272a",
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 4,
        shiftVisibleRangeOnNewBar: false,
      },
      width: containerRef.current.clientWidth,
      height: 420,
    });
    const series = chart.addSeries(LineSeries, {
      color: "#38bdf8",
      lineWidth: 1,
      crosshairMarkerVisible: true,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);
    fittedRef.current = false;

    const unlockPan = () => {
      if (programmaticRef.current) return;
      if (followRef.current) onFollowRef.current?.(false);
    };
    const el = containerRef.current;
    el.addEventListener("pointerdown", unlockPan);
    el.addEventListener("wheel", unlockPan, { passive: true });

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      el.removeEventListener("pointerdown", unlockPan);
      el.removeEventListener("wheel", unlockPan);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const bySec = new Map<number, number>();
    for (const p of prints) {
      const t = Math.floor(p.time);
      bySec.set(t, p.price);
    }
    const data = Array.from(bySec.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([time, value]) => ({ time: time as Time, value }));

    series.setData(data);

    if (!fittedRef.current && data.length) {
      programmaticRef.current = true;
      chart.timeScale().fitContent();
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
      max: 6,
      lookbackSec: 50 * 60,
      types: bigOnly ? ["BIG_TRADE"] : ["BIG_TRADE", "ABSORPTION", "TRAPPED"],
    }).map((e) => ({
      time: Math.floor(e.time) as Time,
      position: (e.side === "BUY" ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
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

  return (
    <div ref={wrapRef} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 text-[10px] text-zinc-500">
        <span>Tick chart · Time & Sales path</span>
        <span>{prints.length} prints</span>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
