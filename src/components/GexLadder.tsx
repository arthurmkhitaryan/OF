import { cn } from "@/lib/cn";
import { formatLevel, type GexSnapshotRecord } from "@/lib/gex";

interface LevelRow {
  key: string;
  label: string;
  value: number | null;
  tone: "put" | "flip" | "call" | "hvl" | "spot";
}

export function GexLadder({ snapshot }: { snapshot: GexSnapshotRecord | null }) {
  if (!snapshot) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-600">
        Нет уровней на этот день
      </div>
    );
  }

  const levels: LevelRow[] = [
    { key: "callWall", label: "Call Wall", value: snapshot.callWall, tone: "call" },
    { key: "hvl", label: "HVL", value: snapshot.hvl, tone: "hvl" },
    { key: "zeroGamma", label: "Zero Gamma", value: snapshot.zeroGamma, tone: "flip" },
    { key: "spot", label: "Spot", value: snapshot.spot, tone: "spot" },
    { key: "putWall", label: "Put Wall", value: snapshot.putWall, tone: "put" },
  ].filter((l) => l.value != null) as LevelRow[];

  // Sort high → low for vertical ladder
  const sorted = [...levels].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  if (sorted.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-600">
        Введи уровни в форме ниже
      </div>
    );
  }

  return (
    <div className="relative space-y-1 py-2">
      <div className="absolute bottom-2 left-4 top-2 w-px bg-zinc-800" />
      {sorted.map((level) => (
        <div key={level.key} className="relative flex items-center gap-3 pl-2">
          <div
            className={cn(
              "z-10 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-zinc-950",
              level.tone === "call" && "bg-emerald-400",
              level.tone === "put" && "bg-red-400",
              level.tone === "flip" && "bg-amber-400",
              level.tone === "hvl" && "bg-violet-400",
              level.tone === "spot" && "bg-sky-400"
            )}
          />
          <div
            className={cn(
              "flex flex-1 items-center justify-between rounded-lg border px-3 py-2",
              level.tone === "spot"
                ? "border-sky-800/60 bg-sky-950/30"
                : "border-zinc-800 bg-zinc-900/50"
            )}
          >
            <span
              className={cn(
                "text-xs font-medium",
                level.tone === "call" && "text-emerald-300",
                level.tone === "put" && "text-red-300",
                level.tone === "flip" && "text-amber-300",
                level.tone === "hvl" && "text-violet-300",
                level.tone === "spot" && "text-sky-300"
              )}
            >
              {level.label}
            </span>
            <span className="font-mono text-sm tabular-nums text-white">
              {formatLevel(level.value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
