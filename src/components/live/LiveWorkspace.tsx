"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LiveChart, type ChartLayers } from "@/components/live/LiveChart";
import { TickChart } from "@/components/live/TickChart";
import { OrderFlowPanel } from "@/components/live/OrderFlowPanel";
import { VolumeProfilePane } from "@/components/live/VolumeProfilePane";
import { SignalPanel } from "@/components/live/SignalPanel";
import { LiveSetupBanner } from "@/components/live/LiveSetupBanner";
import type {
  GexLevelsLite,
  LiveInstrument,
  LiveSignal,
  MarketBar,
  OrderFlowEvent,
  OrderFlowSnapshot,
  VolumeProfileResult,
} from "@/lib/market-types";
import { buildPlansForAccounts } from "@/lib/position-sizing";
import { useRithmicWs } from "@/hooks/useRithmicWs";
import { analyzeOrderFlow } from "@/lib/orderflow-engine";
import { applyPrintsToBars } from "@/lib/bar-utils";
import { computeVolumeProfile } from "@/lib/volume-profile";
import {
  VP_RANGE_PRESETS,
  sliceBarsForVp,
  vpBinSize,
  vpRangeLabel,
  type VpCustomRange,
  type VpRangeMode,
  type VpVisibleRange,
} from "@/lib/vp-range";
import { cn } from "@/lib/cn";
import { Radio, RefreshCw } from "lucide-react";

const DEFAULT_LAYERS: ChartLayers = {
  vp: true,
  delta: true,
  lvn: true,
  gex: false,
  ofMarkers: true,
  ofBigOnly: false,
  levels: true,
};

interface LivePayload {
  type?: string;
  instrument: LiveInstrument;
  source: "bridge" | "none" | "demo" | "yahoo";
  feedSymbol: string;
  error: string | null;
  updatedAt: string;
  bars: MarketBar[];
  profile: VolumeProfileResult;
  gex: GexLevelsLite | null;
  signal: LiveSignal;
  orderflow: OrderFlowEvent[];
  of?: OrderFlowSnapshot;
  bridge: { connected: boolean };
}

interface AccLite {
  id: string;
  name: string;
  maxDrawdown: number | null;
  size: number | null;
}

export function LiveWorkspace() {
  const [instrument, setInstrument] = useState<LiveInstrument>("NQ");
  const [chartMode, setChartMode] = useState<"candles" | "ticks">("ticks");
  const [layers, setLayers] = useState<ChartLayers>(DEFAULT_LAYERS);
  const [followLive, setFollowLive] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const [data, setData] = useState<LivePayload | null>(null);
  const [accounts, setAccounts] = useState<AccLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState(0);
  const [vpMode, setVpMode] = useState<VpRangeMode>("6h");
  const [vpCustom, setVpCustom] = useState<VpCustomRange>(null);
  const [vpVisible, setVpVisible] = useState<VpVisibleRange>(null);
  const [customPickStep, setCustomPickStep] = useState<"idle" | "from" | "to">(
    "idle"
  );
  const [customDraftFrom, setCustomDraftFrom] = useState<number | null>(null);
  const tape = useRithmicWs(instrument);

  useEffect(() => {
    void fetch("/api/accounts")
      .then((r) => r.json())
      .then((list: AccLite[]) => setAccounts(Array.isArray(list) ? list : []))
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    setFollowLive(true);
    setUserPaused(false);
    const es = new EventSource(`/api/market/stream?symbol=${instrument}`);

    es.onopen = () => {
      setLive(true);
      setLoading(false);
    };

    es.onmessage = (ev) => {
      try {
        const json = JSON.parse(ev.data) as LivePayload & {
          type?: string;
          message?: string;
        };
        if (json.type === "error") {
          setErr(json.message ?? "stream error");
          return;
        }
        if (json.type === "heartbeat") {
          setLive(true);
          return;
        }
        if (json.type === "snapshot" || (json.bars && json.signal && !json.type)) {
          setData(json);
          setLoading(false);
          setErr(null);
          setLive(true);
        }
      } catch {
        /* ignore parse */
      }
    };

    es.onerror = () => {
      setLive(false);
      setErr("SSE reconnecting…");
    };

    return () => {
      es.close();
      setLive(false);
    };
  }, [instrument, streamKey]);

  const reconnect = useCallback(() => {
    setErr(null);
    setStreamKey((k) => k + 1);
  }, []);

  const plans = useMemo(() => {
    if (!data?.signal) return [];
    return buildPlansForAccounts(
      data.instrument,
      data.signal,
      accounts.map((a) => ({
        id: a.id,
        name: a.name,
        maxDrawdown: a.maxDrawdown,
        size: a.size,
      }))
    );
  }, [data, accounts]);

  const primary = plans[0];
  const of = useMemo(() => {
    if (tape.prints.length > 0) {
      return analyzeOrderFlow(instrument, tape.prints, "bridge");
    }
    return data?.of ?? null;
  }, [tape.prints, instrument, data?.of]);

  const displayBars = useMemo(() => {
    if (!data?.bars?.length) return data?.bars ?? [];
    const base = data.bars;
    const lastT = base[base.length - 1]!.time;
    const livePrints = tape.prints.filter((p) => p.time >= lastT - 60);
    let bars = applyPrintsToBars(base, livePrints);
    if (tape.lastMid != null && bars.length) {
      const last = { ...bars[bars.length - 1]! };
      last.high = Math.max(last.high, tape.lastMid);
      last.low = Math.min(last.low, tape.lastMid);
      last.close = tape.lastMid;
      bars = [...bars.slice(0, -1), last];
    }
    return bars;
  }, [data?.bars, tape.prints, tape.lastMid]);

  const profile = useMemo(() => {
    const slice = sliceBarsForVp(displayBars, vpMode, {
      custom: vpCustom,
      visible: vpVisible,
    });
    if (!slice.length) return data?.profile ?? null;
    return computeVolumeProfile(slice, vpBinSize(instrument));
  }, [displayBars, vpMode, vpCustom, vpVisible, instrument, data?.profile]);

  const vpLabel = useMemo(() => {
    const slice = sliceBarsForVp(displayBars, vpMode, {
      custom: vpCustom,
      visible: vpVisible,
    });
    return vpRangeLabel(vpMode, {
      custom: vpCustom,
      visible: vpVisible,
      barCount: slice.length,
    });
  }, [displayBars, vpMode, vpCustom, vpVisible]);

  const selectVpMode = useCallback((mode: VpRangeMode) => {
    setVpMode(mode);
    if (mode === "custom") {
      setCustomPickStep("from");
      setCustomDraftFrom(null);
      setVpCustom(null);
      setUserPaused(true);
      setFollowLive(false);
      setChartMode("candles");
    } else {
      setCustomPickStep("idle");
      setCustomDraftFrom(null);
    }
  }, []);

  const onCustomTimePicked = useCallback(
    (time: number) => {
      if (customPickStep === "from") {
        setCustomDraftFrom(time);
        setCustomPickStep("to");
        return;
      }
      if (customPickStep === "to" && customDraftFrom != null) {
        const from = Math.min(customDraftFrom, time);
        const to = Math.max(customDraftFrom, time);
        setVpCustom({ from, to });
        setCustomPickStep("idle");
        setCustomDraftFrom(null);
      }
    },
    [customPickStep, customDraftFrom]
  );

  useEffect(() => {
    if (userPaused) return;
    if (tape.lastMs != null || tape.prints.length > 0) {
      setFollowLive(true);
    }
  }, [tape.lastMs, tape.prints.length, userPaused]);

  const entry = primary?.entry ?? data?.signal.entryZone ?? null;
  const stop = primary?.stop ?? data?.signal.stop ?? null;
  const take = primary?.take ?? data?.signal.targets[0] ?? null;

  return (
    <div className="space-y-4">
      <LiveSetupBanner
        bridgeConnected={data?.bridge.connected ?? false}
        ofSource={of?.source}
        priceSource={data?.source}
        feedError={data?.error}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1">
            {(["NQ", "ES"] as LiveInstrument[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInstrument(s)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm",
                  instrument === s
                    ? "bg-emerald-600 text-white"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1">
            {(
              [
                ["candles", "1m candles"],
                ["ticks", "Ticks"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setChartMode(mode)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm",
                  chartMode === mode
                    ? "bg-sky-700 text-white"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2 py-1",
              live
                ? "border-emerald-800/60 text-emerald-400"
                : "border-zinc-700 text-zinc-500"
            )}
          >
            <Radio size={12} className={live ? "animate-pulse" : undefined} />
            {live ? "SSE" : "SSE off"}
            {tape.status === "open" ? (
              <span className="text-emerald-400"> · WS ms</span>
            ) : (
              <span className="text-zinc-600"> · WS {tape.status}</span>
            )}
          </span>
          {data && (
            <span>
              price: <span className="text-zinc-300">{data.source}</span>
              {data.feedSymbol && (
                <>
                  {" · "}
                  <span className="font-mono text-sky-400">{data.feedSymbol}</span>
                </>
              )}
              {of && (
                <>
                  {" · "}
                  OF:{" "}
                  <span
                    className={
                      of.source === "bridge"
                        ? "text-emerald-400"
                        : of.source === "demo"
                          ? "text-amber-300"
                          : "text-zinc-500"
                    }
                  >
                    {of.source}
                    {tape.prints.length ? ` · ${tape.prints.length} ticks` : ""}
                  </span>
                </>
              )}
              {tape.lastMs != null &&
                ` · ${new Date(tape.lastMs).toLocaleTimeString()}.${String(
                  tape.lastMs % 1000
                ).padStart(3, "0")}`}
              {!tape.lastMs &&
                data.updatedAt &&
                ` · ${new Date(data.updatedAt).toLocaleTimeString()}`}
            </span>
          )}
          <button
            type="button"
            onClick={reconnect}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 hover:border-zinc-500 hover:text-white"
          >
            <RefreshCw size={12} />
            Reconnect
          </button>
        </div>
      </div>

      {data?.feedSymbol?.startsWith("NQ") && data.source === "bridge" && (
        <p className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200/90">
          Сравнивай на TradingView{" "}
          <strong className="text-amber-100">CME_MINI:NQU2026</strong> (front
          month), не continuous <code className="text-zinc-400">NQ1!</code>.
          Фид:{" "}
          <strong className="font-mono text-sky-300">{data.feedSymbol}</strong>{" "}
          · Lucid / Rithmic. На графике — <strong>Live follow</strong>, если
          Paused.
        </p>
      )}

      {err && (
        <p className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
          {err}
        </p>
      )}

      {data && (
        <>
          <SignalPanel signal={data.signal} instrument={data.instrument} plans={plans} />

          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <LayerToggles layers={layers} onChange={setLayers} />
                <button
                  type="button"
                  onClick={() => {
                    setUserPaused(false);
                    setFollowLive(true);
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px]",
                    followLive && !userPaused
                      ? "border-emerald-700/80 bg-emerald-950/40 text-emerald-300"
                      : "border-zinc-700 text-zinc-400 hover:text-white"
                  )}
                >
                  {followLive && !userPaused
                    ? "● Live follow"
                    : "⏸ Paused — click to follow"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-zinc-500">VP range</span>
                <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1">
                  {VP_RANGE_PRESETS.map(({ mode, label }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => selectVpMode(mode)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px]",
                        vpMode === mode
                          ? "bg-violet-700 text-white"
                          : "text-zinc-400 hover:text-white"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-zinc-600">{vpLabel}</span>
              </div>

              {customPickStep !== "idle" && (
                <p className="rounded-lg border border-sky-800/50 bg-sky-950/30 px-3 py-2 text-[11px] text-sky-200">
                  {customPickStep === "from"
                    ? "Custom VP: кликни на графике начало диапазона"
                    : "Custom VP: кликни конец диапазона"}
                  {customDraftFrom != null && (
                    <span className="ml-2 text-zinc-400">
                      from{" "}
                      {new Date(customDraftFrom * 1000).toLocaleTimeString()}
                    </span>
                  )}
                </p>
              )}

              {chartMode === "candles" ? (
                <LiveChart
                  key={`${instrument}-candles`}
                  bars={displayBars}
                  profile={profile}
                  prints={of?.prints ?? []}
                  gex={data.gex}
                  orderflow={of?.events ?? data.orderflow}
                  entryZone={entry}
                  stopPrice={stop}
                  takePrice={take}
                  layers={layers}
                  followLive={followLive && !userPaused}
                  livePrice={tape.lastMid}
                  onFollowLiveChange={(v) => {
                    if (!v) setUserPaused(true);
                    setFollowLive(v);
                  }}
                  onVisibleTimeRangeChange={setVpVisible}
                  customPickActive={customPickStep !== "idle"}
                  onCustomTimePicked={onCustomTimePicked}
                  highlightRange={
                    vpMode === "custom"
                      ? vpCustom ??
                        (customDraftFrom != null
                          ? { from: customDraftFrom, to: customDraftFrom }
                          : null)
                      : null
                  }
                />
              ) : (
                <TickChart
                  key={`${instrument}-ticks`}
                  prints={of?.prints ?? []}
                  events={of?.events ?? []}
                  entryZone={entry}
                  stopPrice={stop}
                  takePrice={take}
                  bigOnly={layers.ofBigOnly}
                  followLive={followLive && !userPaused}
                  livePrice={tape.lastMid}
                  onFollowLiveChange={(v) => {
                    if (!v) setUserPaused(true);
                    setFollowLive(v);
                  }}
                />
              )}
              <VolumeProfilePane profile={profile} rangeLabel={vpLabel} />
              <p className="text-[10px] text-zinc-600">
                OF: Big ≥ {instrument === "NQ" ? 40 : 100} lots · Absorption =
                объём у уровня без продолжения цены · Δ из aggressor tape · VP
                пересчитывается по выбранному range.
              </p>
            </div>
            <OrderFlowPanel of={of} />
          </div>
        </>
      )}

      {loading && !data && (
        <div className="h-80 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
      )}
    </div>
  );
}

function LayerToggles({
  layers,
  onChange,
}: {
  layers: ChartLayers;
  onChange: (l: ChartLayers) => void;
}) {
  const items: { key: keyof ChartLayers; label: string }[] = [
    { key: "vp", label: "VP ←" },
    { key: "delta", label: "Δ →" },
    { key: "lvn", label: "LVN" },
    { key: "levels", label: "Entry/SL/TP" },
    { key: "gex", label: "GEX" },
    { key: "ofMarkers", label: "OF marks" },
    { key: "ofBigOnly", label: "Big only" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange({ ...layers, [key]: !layers[key] })}
          className={cn(
            "rounded-md border px-2.5 py-1 text-[11px]",
            layers[key]
              ? "border-sky-700/80 bg-sky-950/40 text-sky-300"
              : "border-zinc-800 text-zinc-600 hover:text-zinc-400"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
