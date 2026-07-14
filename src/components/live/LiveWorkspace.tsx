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
import { cn } from "@/lib/cn";
import { Radio, RefreshCw } from "lucide-react";

const DEFAULT_LAYERS: ChartLayers = {
  vp: true,
  delta: true,
  lvn: true,
  gex: false,
  ofMarkers: true,
  ofBigOnly: true,
  levels: true,
};

interface LivePayload {
  type?: string;
  instrument: LiveInstrument;
  source: "yahoo" | "demo" | "bridge";
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
  const [chartMode, setChartMode] = useState<"candles" | "ticks">("candles");
  const [layers, setLayers] = useState<ChartLayers>(DEFAULT_LAYERS);
  const [followLive, setFollowLive] = useState(true);
  const [data, setData] = useState<LivePayload | null>(null);
  const [accounts, setAccounts] = useState<AccLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState(0);

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
    const es = new EventSource(`/api/market/stream?symbol=${instrument}`);

    es.onopen = () => {
      setLive(true);
      setLoading(false);
    };

    es.onmessage = (ev) => {
      try {
        const json = JSON.parse(ev.data) as LivePayload & { type?: string; message?: string };
        if (json.type === "error") {
          setErr(json.message ?? "stream error");
          return;
        }
        if (json.bars && json.signal) {
          setData(json);
          setLoading(false);
          setErr(null);
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
  const of = data?.of ?? null;
  const entry = primary?.entry ?? data?.signal.entryZone ?? null;
  const stop = primary?.stop ?? data?.signal.stop ?? null;
  const take = primary?.take ?? data?.signal.targets[0] ?? null;

  return (
    <div className="space-y-4">
      <LiveSetupBanner
        bridgeConnected={data?.bridge.connected ?? false}
        ofSource={of?.source}
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
            {live ? "SSE live" : "offline"}
          </span>
          {data && (
            <span>
              price: <span className="text-zinc-300">{data.source}</span>
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
                  </span>
                </>
              )}
              {data.updatedAt && ` · ${new Date(data.updatedAt).toLocaleTimeString()}`}
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
                  onClick={() => setFollowLive(true)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px]",
                    followLive
                      ? "border-emerald-700/80 bg-emerald-950/40 text-emerald-300"
                      : "border-zinc-700 text-zinc-400 hover:text-white"
                  )}
                >
                  {followLive ? "● Live follow" : "⏸ Paused — click to follow"}
                </button>
              </div>
              {chartMode === "candles" ? (
                <LiveChart
                  key={`${instrument}-candles`}
                  bars={data.bars}
                  profile={data.profile}
                  prints={of?.prints ?? []}
                  gex={data.gex}
                  orderflow={data.orderflow}
                  entryZone={entry}
                  stopPrice={stop}
                  takePrice={take}
                  layers={layers}
                  followLive={followLive}
                  onFollowLiveChange={setFollowLive}
                />
              ) : (
                <TickChart
                  key={`${instrument}-ticks`}
                  prints={of?.prints ?? []}
                  events={of?.events ?? data.orderflow}
                  entryZone={entry}
                  stopPrice={stop}
                  takePrice={take}
                  bigOnly={layers.ofBigOnly}
                  followLive={followLive}
                  onFollowLiveChange={setFollowLive}
                />
              )}
              <p className="text-[10px] text-zinc-600">
                Слева VP · справа Δ. Двигай график — автоскролл выключится. Тики ~200мс.
              </p>
              <details className="rounded-xl border border-zinc-800 bg-zinc-900/40">
                <summary className="cursor-pointer px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300">
                  Volume Profile — список уровней
                </summary>
                <div className="border-t border-zinc-800 p-2">
                  <VolumeProfilePane profile={data.profile} />
                </div>
              </details>
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
