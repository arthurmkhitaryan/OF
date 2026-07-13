export const GEX_INSTRUMENTS = ["NQ", "ES"] as const;
export type GexInstrument = (typeof GEX_INSTRUMENTS)[number];

export const GEX_SOURCES = ["CBOE", "SpotGamma", "MenthorQ", "Other"] as const;
export type GexSource = (typeof GEX_SOURCES)[number];

export interface GexSnapshotInput {
  date: string; // YYYY-MM-DD
  instrument: GexInstrument;
  spot?: number | null;
  zeroGamma?: number | null;
  callWall?: number | null;
  putWall?: number | null;
  hvl?: number | null;
  source?: string | null;
  notes?: string | null;
}

export interface GexSnapshotRecord {
  id: string;
  date: string;
  instrument: GexInstrument;
  spot: number | null;
  zeroGamma: number | null;
  callWall: number | null;
  putWall: number | null;
  hvl: number | null;
  source: string | null;
  notes: string | null;
  profile: GexStrikeBar[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface GexStrikeBar {
  strike: number;
  volume: number;
  netGex: number;
  callGex: number;
  putGex: number;
}

/** Normalize calendar date to noon UTC so unique(date, instrument) is stable across TZ */
export function parseGexDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function formatGexDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toGexRecord(row: {
  id: string;
  date: Date;
  instrument: string;
  spot: number | null;
  zeroGamma: number | null;
  callWall: number | null;
  putWall: number | null;
  hvl: number | null;
  source: string | null;
  notes: string | null;
  profile?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): GexSnapshotRecord {
  let profile: GexStrikeBar[] | null = null;
  if (row.profile) {
    try {
      profile = JSON.parse(row.profile) as GexStrikeBar[];
    } catch {
      profile = null;
    }
  }

  return {
    id: row.id,
    date: formatGexDate(row.date),
    instrument: row.instrument as GexInstrument,
    spot: row.spot,
    zeroGamma: row.zeroGamma,
    callWall: row.callWall,
    putWall: row.putWall,
    hvl: row.hvl,
    source: row.source,
    notes: row.notes,
    profile,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function formatLevel(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
