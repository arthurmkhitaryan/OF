"use client";

import type { OrderFlowSnapshot } from "@/lib/market-types";
import { cn } from "@/lib/cn";

export function OrderFlowPanel({ of }: { of: OrderFlowSnapshot | null }) {
  if (!of) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-xs text-zinc-600">
        Нет order flow
      </div>
    );
  }

  const maxAbs = Math.max(...of.delta.map((d) => Math.abs(d.delta)), 1);
  const recent = of.events.slice(0, 24);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-300">Order Flow</p>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px]",
              of.source === "bridge"
                ? "bg-emerald-950 text-emerald-400"
                : of.source === "demo"
                  ? "bg-amber-950 text-amber-300"
                  : "bg-zinc-900 text-zinc-500"
            )}
          >
            {of.source === "bridge"
              ? "Rithmic bridge"
              : of.source === "demo"
                ? "DEMO tape"
                : "OF offline — start bridge"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
          <Stat
            label="Cum Δ"
            value={`${of.cumDelta > 0 ? "+" : ""}${Math.round(of.cumDelta)}`}
            tone={of.cumDelta >= 0 ? "up" : "down"}
          />
          <Stat
            label="Big"
            value={String(of.events.filter((e) => e.type === "BIG_TRADE").length)}
          />
          <Stat
            label="Abs / Trp"
            value={`${of.events.filter((e) => e.type === "ABSORPTION").length} / ${of.events.filter((e) => e.type === "TRAPPED").length}`}
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <p className="mb-2 text-xs font-medium text-zinc-400">Delta (1m)</p>
        <div className="flex h-24 items-end gap-px">
          {of.delta.slice(-48).map((d) => {
            const h = Math.max(4, (Math.abs(d.delta) / maxAbs) * 100);
            return (
              <div
                key={d.time}
                title={`Δ ${d.delta} · ${new Date(d.time * 1000).toLocaleTimeString()}`}
                className={cn(
                  "min-w-0 flex-1 rounded-sm",
                  d.delta >= 0 ? "bg-emerald-500/70" : "bg-red-500/70"
                )}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <p className="mb-2 text-xs font-medium text-zinc-400">Events</p>
        <ul className="max-h-56 space-y-1.5 overflow-y-auto text-[11px]">
          {recent.length === 0 && (
            <li className="text-zinc-600">Пока нет events</li>
          )}
          {recent.map((e, i) => (
            <li
              key={`${e.type}-${e.time}-${e.price}-${i}`}
              className="flex items-start justify-between gap-2 border-b border-zinc-800/60 pb-1"
            >
              <div>
                <span
                  className={cn(
                    "font-medium",
                    e.type === "BIG_TRADE" && "text-orange-400",
                    e.type === "ABSORPTION" && "text-fuchsia-400",
                    e.type === "TRAPPED" && "text-yellow-300"
                  )}
                >
                  {e.type}
                </span>
                <span className="ml-1.5 text-zinc-500">
                  {e.side} {e.size ?? ""} @ {e.price}
                </span>
                {e.note && <p className="text-zinc-600">{e.note}</p>}
              </div>
              <span className="shrink-0 text-zinc-600">
                {new Date(e.time * 1000).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <p className="mb-2 text-xs font-medium text-zinc-400">Tape (last)</p>
        <ul className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-[10px]">
          {[...of.prints].slice(-40).reverse().map((p, i) => (
            <li key={`${p.time}-${i}`} className="flex justify-between gap-2">
              <span className={p.side === "BUY" ? "text-emerald-400" : "text-red-400"}>
                {p.side === "BUY" ? "B" : "S"} {p.size}
              </span>
              <span className="text-zinc-300">{p.price}</span>
              <span className="text-zinc-600">
                {new Date(p.time * 1000).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-1.5">
      <p className="text-[10px] text-zinc-600">{label}</p>
      <p
        className={cn(
          "font-mono text-sm",
          tone === "up" && "text-emerald-400",
          tone === "down" && "text-red-400",
          !tone && "text-zinc-200"
        )}
      >
        {value}
      </p>
    </div>
  );
}
