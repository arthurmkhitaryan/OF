import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { parseGexDate, toGexRecord, type GexSnapshotRecord } from "@/lib/gex";
import { fetchLiveGex, type ComputedGexLevels } from "@/lib/gex-cboe";

const STALE_MS = 30 * 60 * 1000; // 30 minutes

export async function getGexForDate(dateStr?: string): Promise<{
  date: string;
  NQ: GexSnapshotRecord | null;
  ES: GexSnapshotRecord | null;
}> {
  const date = dateStr ?? format(new Date(), "yyyy-MM-dd");
  const rows = await prisma.gexSnapshot.findMany({
    where: { date: parseGexDate(date) },
  });

  return {
    date,
    NQ: rows.find((r) => r.instrument === "NQ")
      ? toGexRecord(rows.find((r) => r.instrument === "NQ")!)
      : null,
    ES: rows.find((r) => r.instrument === "ES")
      ? toGexRecord(rows.find((r) => r.instrument === "ES")!)
      : null,
  };
}

export async function saveComputedGex(
  levels: ComputedGexLevels[],
  dateStr?: string
): Promise<GexSnapshotRecord[]> {
  const dateKey = dateStr ?? format(new Date(), "yyyy-MM-dd");
  const date = parseGexDate(dateKey);
  const saved: GexSnapshotRecord[] = [];

  for (const level of levels) {
    const row = await prisma.gexSnapshot.upsert({
      where: {
        date_instrument: { date, instrument: level.instrument },
      },
      create: {
        date,
        instrument: level.instrument,
        spot: level.spot,
        zeroGamma: level.zeroGamma,
        callWall: level.callWall,
        putWall: level.putWall,
        hvl: level.hvl,
        source: level.source,
        notes: level.notes,
        profile: JSON.stringify(level.profile),
      },
      update: {
        spot: level.spot,
        zeroGamma: level.zeroGamma,
        callWall: level.callWall,
        putWall: level.putWall,
        hvl: level.hvl,
        source: level.source,
        notes: level.notes,
        profile: JSON.stringify(level.profile),
      },
    });
    saved.push(toGexRecord(row));
  }

  return saved;
}

export async function refreshGexFromCboe(dateStr?: string): Promise<{
  date: string;
  NQ: GexSnapshotRecord | null;
  ES: GexSnapshotRecord | null;
  refreshedAt: string;
}> {
  const dateKey = dateStr ?? format(new Date(), "yyyy-MM-dd");
  const levels = await fetchLiveGex(["ES", "NQ"]);
  const saved = await saveComputedGex(levels, dateKey);

  return {
    date: dateKey,
    NQ: saved.find((s) => s.instrument === "NQ") ?? null,
    ES: saved.find((s) => s.instrument === "ES") ?? null,
    refreshedAt: new Date().toISOString(),
  };
}

/** Auto-pull CBOE when viewing today and data missing or older than 30m */
export async function ensureTodayGexFresh(): Promise<{
  date: string;
  NQ: GexSnapshotRecord | null;
  ES: GexSnapshotRecord | null;
  autoRefreshed: boolean;
  error?: string;
}> {
  const today = format(new Date(), "yyyy-MM-dd");
  const existing = await getGexForDate(today);
  const now = Date.now();

  const needsRefresh =
    !existing.NQ ||
    !existing.ES ||
    !existing.NQ.profile?.length ||
    !existing.ES.profile?.length ||
    !existing.NQ.updatedAt ||
    now - new Date(existing.NQ.updatedAt).getTime() > STALE_MS ||
    now - new Date(existing.ES!.updatedAt).getTime() > STALE_MS;

  if (!needsRefresh) {
    return { ...existing, autoRefreshed: false };
  }

  try {
    const refreshed = await refreshGexFromCboe(today);
    return {
      date: refreshed.date,
      NQ: refreshed.NQ,
      ES: refreshed.ES,
      autoRefreshed: true,
    };
  } catch (err) {
    return {
      ...existing,
      autoRefreshed: false,
      error: err instanceof Error ? err.message : "CBOE fetch failed",
    };
  }
}
