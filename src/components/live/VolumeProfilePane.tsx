"use client";

import type { VolumeProfileResult } from "@/lib/market-types";

export function VolumeProfilePane({ profile }: { profile: VolumeProfileResult | null }) {
  if (!profile || profile.bins.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-zinc-800 text-xs text-zinc-600">
        Нет Volume Profile
      </div>
    );
  }

  const maxVol = Math.max(...profile.bins.map((b) => b.volume), 1);
  // Show denser mid section — sample if too many bins
  const step = profile.bins.length > 80 ? Math.ceil(profile.bins.length / 70) : 1;
  const bins = profile.bins.filter((_, i) => i % step === 0).reverse();

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <p className="mb-2 text-xs font-medium text-zinc-400">Volume Profile</p>
      <div className="mb-2 grid grid-cols-3 gap-1 text-[10px]">
        <Stat label="VAH" value={profile.vah} color="text-sky-400" />
        <Stat label="POC" value={profile.poc} color="text-violet-400" />
        <Stat label="VAL" value={profile.val} color="text-sky-400" />
      </div>
      {profile.lvn.length > 0 && (
        <p className="mb-2 text-[10px] text-orange-400">
          LVN: {profile.lvn.map((p) => p.toFixed(0)).join(" · ")}
        </p>
      )}
      <div className="flex-1 space-y-0.5 overflow-y-auto pr-1" style={{ maxHeight: 360 }}>
        {bins.map((bin) => {
          const isPoc = bin.price === profile.poc;
          const inVa = bin.price >= profile.val && bin.price <= profile.vah;
          const isLvn = profile.lvn.includes(bin.price);
          return (
            <div key={bin.price} className="flex items-center gap-1.5">
              <span
                className={`w-12 shrink-0 text-right font-mono text-[9px] tabular-nums ${
                  isPoc
                    ? "text-violet-300"
                    : isLvn
                      ? "text-amber-300"
                      : "text-zinc-600"
                }`}
              >
                {bin.price}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-zinc-800">
                <div
                  className={`h-full rounded-sm ${
                    isPoc
                      ? "bg-violet-500"
                      : isLvn
                        ? "bg-amber-500/80"
                        : inVa
                          ? "bg-sky-600/70"
                          : "bg-zinc-600"
                  }`}
                  style={{ width: `${(bin.volume / maxVol) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-zinc-600">
        Regime: {profile.regime} · bias {profile.trendBias}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded border border-zinc-800 px-1.5 py-1">
      <p className="text-zinc-600">{label}</p>
      <p className={`font-mono tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
