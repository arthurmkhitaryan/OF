import { formatLevel, type GexInstrument, type GexSnapshotRecord } from "@/lib/gex";
import { GexLadder } from "@/components/GexLadder";
import { GexForm } from "@/components/GexForm";
import { GexVolumeChart } from "@/components/GexVolumeChart";

interface Props {
  date: string;
  instrument: GexInstrument;
  snapshot: GexSnapshotRecord | null;
}

const PROXY_LABEL: Record<GexInstrument, string> = {
  ES: "SPX options",
  NQ: "QQQ→NDX scale",
};

export function GexInstrumentPanel({ date, instrument, snapshot }: Props) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">{instrument}</h2>
          <p className="text-xs text-zinc-500">
            {snapshot?.source
              ? `Источник: ${snapshot.source} · ${PROXY_LABEL[instrument]}`
              : `Gamma Exposure · ${PROXY_LABEL[instrument]}`}
            {snapshot?.notes?.includes("confidence: high")
              ? " · надёжность: высокая"
              : snapshot?.notes?.includes("confidence: medium")
                ? " · надёжность: средняя"
                : snapshot?.notes?.includes("confidence: low")
                  ? " · надёжность: низкая"
                  : ""}
          </p>
        </div>
        {snapshot?.spot != null && (
          <div className="text-right">
            <p className="text-[10px] text-zinc-500">
              Spot {instrument === "NQ" ? "(NDX)" : "(SPX)"}
            </p>
            <p className="font-mono text-sm tabular-nums text-sky-300">
              {formatLevel(snapshot.spot)}
            </p>
          </div>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <LevelChip label="Put Wall" value={snapshot?.putWall} tone="put" />
        <LevelChip label="Zero Gamma" value={snapshot?.zeroGamma} tone="flip" />
        <LevelChip label="Call Wall" value={snapshot?.callWall} tone="call" />
        <LevelChip label="HVL" value={snapshot?.hvl} tone="hvl" />
      </div>

      <GexLadder snapshot={snapshot} />

      <div className="mt-4 border-t border-zinc-800 pt-4">
        <GexVolumeChart
          profile={snapshot?.profile}
          spot={snapshot?.spot}
          callWall={snapshot?.callWall}
          putWall={snapshot?.putWall}
          zeroGamma={snapshot?.zeroGamma}
        />
      </div>

      {snapshot?.notes && (
        <p className="mt-3 text-sm text-zinc-400">{snapshot.notes}</p>
      )}

      <details className="mt-4 border-t border-zinc-800 pt-3">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
          Ручная правка уровней
        </summary>
        <div className="mt-3">
          <GexForm date={date} instrument={instrument} initial={snapshot} />
        </div>
      </details>
    </div>
  );
}

function LevelChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null | undefined;
  tone: "put" | "flip" | "call" | "hvl";
}) {
  const color =
    tone === "put"
      ? "text-red-400"
      : tone === "call"
        ? "text-emerald-400"
        : tone === "flip"
          ? "text-amber-400"
          : "text-violet-400";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-2">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className={`font-mono text-sm tabular-nums ${color}`}>{formatLevel(value ?? null)}</p>
    </div>
  );
}
