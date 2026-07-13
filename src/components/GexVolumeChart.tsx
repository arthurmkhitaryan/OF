"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GexStrikeBar } from "@/lib/gex";
import { formatLevel } from "@/lib/gex";

interface Props {
  profile: GexStrikeBar[] | null | undefined;
  spot: number | null | undefined;
  callWall?: number | null;
  putWall?: number | null;
  zeroGamma?: number | null;
}

export function GexVolumeChart({
  profile,
  spot,
  callWall,
  putWall,
  zeroGamma,
}: Props) {
  if (!profile || profile.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-xs text-zinc-600">
        Нет профиля — нажми «Обновить с CBOE»
      </div>
    );
  }

  // Thin dense strikes: keep every Nth if too many for readability
  const step = profile.length > 60 ? Math.ceil(profile.length / 50) : 1;
  const data = profile.filter((_, i) => i % step === 0 || isKeyStrike(profile[i].strike));

  function isKeyStrike(strike: number) {
    const keys = [spot, callWall, putWall, zeroGamma].filter(
      (v): v is number => v != null
    );
    return keys.some((k) => Math.abs(k - strike) < strike * 0.0005);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-400">Объём по страйкам (±5%)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="strike"
              tick={{ fill: "#71717a", fontSize: 9 }}
              tickFormatter={(v) => String(Math.round(Number(v)))}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fill: "#71717a", fontSize: 9 }} width={40} />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }}
              labelFormatter={(v) => `Strike ${formatLevel(Number(v))}`}
              formatter={(value) => [Number(value ?? 0).toLocaleString(), "Volume"]}
            />
            {spot != null && (
              <ReferenceLine x={nearest(data, spot)} stroke="#38bdf8" strokeDasharray="4 4" />
            )}
            <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
              {data.map((entry, i) => {
                const aboveSpot = spot == null || entry.strike >= spot;
                return (
                  <Cell
                    key={i}
                    fill={aboveSpot ? "#34d399" : "#f87171"}
                    fillOpacity={0.85}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-1 text-[10px] text-zinc-600">
          Зелёный объём — call-side (≥ spot) · красный — put-side (&lt; spot)
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-zinc-400">Net GEX по страйкам</p>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="strike"
              tick={{ fill: "#71717a", fontSize: 9 }}
              tickFormatter={(v) => String(Math.round(Number(v)))}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fill: "#71717a", fontSize: 9 }} width={48} />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }}
              labelFormatter={(v) => `Strike ${formatLevel(Number(v))}`}
              formatter={(value) => [Number(value ?? 0).toLocaleString(), "Net GEX"]}
            />
            {spot != null && (
              <ReferenceLine x={nearest(data, spot)} stroke="#38bdf8" strokeDasharray="4 4" />
            )}
            {putWall != null && (
              <ReferenceLine x={nearest(data, putWall)} stroke="#f87171" strokeDasharray="2 2" />
            )}
            {callWall != null && (
              <ReferenceLine x={nearest(data, callWall)} stroke="#34d399" strokeDasharray="2 2" />
            )}
            {zeroGamma != null && (
              <ReferenceLine x={nearest(data, zeroGamma)} stroke="#fbbf24" strokeDasharray="2 2" />
            )}
            <Bar dataKey="netGex" radius={[2, 2, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.netGex >= 0 ? "#60a5fa" : "#f87171"} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-1 text-[10px] text-zinc-600">
          Синяя линия — spot · зелёная Call Wall · красная Put Wall · жёлтая Zero Gamma
        </p>
      </div>
    </div>
  );
}

function nearest(data: GexStrikeBar[], target: number): number {
  if (!data.length) return target;
  return data.reduce((best, row) =>
    Math.abs(row.strike - target) < Math.abs(best - target) ? row.strike : best
  , data[0].strike);
}
