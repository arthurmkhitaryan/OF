import Link from "next/link";
import { formatLevel, type GexSnapshotRecord } from "@/lib/gex";
import { cn } from "@/lib/cn";

interface Props {
  date: string;
  NQ: GexSnapshotRecord | null;
  ES: GexSnapshotRecord | null;
}

function MiniLevels({ label, snap }: { label: string; snap: GexSnapshotRecord | null }) {
  if (!snap) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 p-3">
        <p className="text-xs font-medium text-zinc-400">{label}</p>
        <p className="mt-1 text-xs text-zinc-600">Не задано</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-white">{label}</p>
        {snap.spot != null && (
          <p className="font-mono text-xs tabular-nums text-sky-400">{formatLevel(snap.spot)}</p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <LevelChip label="Put" value={snap.putWall} className="text-red-400" />
        <LevelChip label="Flip" value={snap.zeroGamma} className="text-amber-400" />
        <LevelChip label="Call" value={snap.callWall} className="text-emerald-400" />
      </div>
    </div>
  );
}

function LevelChip({
  label,
  value,
  className,
}: {
  label: string;
  value: number | null;
  className?: string;
}) {
  return (
    <div>
      <p className="text-zinc-600">{label}</p>
      <p className={cn("font-mono tabular-nums", className)}>{formatLevel(value)}</p>
    </div>
  );
}

export function GexTodayWidget({ date, NQ, ES }: Props) {
  const hasAny = NQ || ES;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">GEX сегодня</h2>
          <p className="text-[10px] text-zinc-600">{date}</p>
        </div>
        <Link href="/gex" className="text-xs text-emerald-400 hover:underline">
          {hasAny ? "Открыть →" : "Добавить уровни →"}
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <MiniLevels label="NQ" snap={NQ} />
        <MiniLevels label="ES" snap={ES} />
      </div>
    </div>
  );
}
