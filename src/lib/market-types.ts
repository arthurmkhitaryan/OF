export type LiveInstrument = "NQ" | "ES";

export interface MarketBar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface VolumeBin {
  price: number;
  volume: number;
}

export interface VolumeProfileResult {
  bins: VolumeBin[];
  poc: number;
  vah: number;
  val: number;
  lvn: number[];
  hvn: number[];
  totalVolume: number;
  vaShift: number;
  regime: "BALANCED" | "IMBALANCED" | "UNCLEAR";
  trendBias: "UP" | "DOWN" | "FLAT";
}

export interface GexLevelsLite {
  spot: number | null;
  zeroGamma: number | null;
  callWall: number | null;
  putWall: number | null;
  hvl: number | null;
}

export type SignalStatus = "SIGNAL" | "WATCH" | "NO_TRADE";
export type SignalModel = "RANGE" | "TREND";
export type SignalDirection = "LONG" | "SHORT" | null;
export type SignalQuality = "A_PLUS" | "A" | "B" | "C";

export interface LiveSignal {
  status: SignalStatus;
  model: SignalModel | null;
  direction: SignalDirection;
  quality: SignalQuality | null;
  entryZone: number | null;
  stop: number | null;
  targets: number[];
  reasons: string[];
  missing: string[];
  summary: string;
}

export interface OrderFlowEvent {
  type: "BIG_TRADE" | "ABSORPTION" | "TRAPPED";
  instrument: LiveInstrument;
  price: number;
  size?: number;
  side?: "BUY" | "SELL";
  time: number;
  note?: string;
}

/** Aggressor print (tick / time & sales) */
export interface TickPrint {
  time: number; // unix seconds (can be fractional for demo)
  price: number;
  size: number;
  side: "BUY" | "SELL";
}

export interface DeltaBar {
  time: number;
  delta: number;
  buyVol: number;
  sellVol: number;
  close: number;
}

export interface OrderFlowSnapshot {
  source: "bridge" | "demo" | "none";
  prints: TickPrint[];
  events: OrderFlowEvent[];
  delta: DeltaBar[];
  /** cumulative delta over window */
  cumDelta: number;
}

