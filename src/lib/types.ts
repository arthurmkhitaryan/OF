import type {
  DIRECTIONS,
  ENTRY_TYPES,
  INSTRUMENTS,
  MISTAKE_TAGS,
  MODELS,
  SESSIONS,
  SETUP_QUALITIES,
} from "./constants";

export type Instrument = (typeof INSTRUMENTS)[number];
export type Model = (typeof MODELS)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type EntryType = (typeof ENTRY_TYPES)[number];
export type SetupQuality = (typeof SETUP_QUALITIES)[number];
export type Session = (typeof SESSIONS)[number];
export type MistakeTag = (typeof MISTAKE_TAGS)[number];

export interface AccountInput {
  name: string;
  firm: string;
  type: "EVAL" | "FUNDED";
  status: "ACTIVE" | "PAUSED" | "PASSED" | "FAILED";
  size?: number | null;
  notes?: string | null;
  color?: string;
  startingBalance?: number | null;
  currentBalance?: number | null;
  profitTarget?: number | null;
  maxDrawdown?: number | null;
  dailyLossLimit?: number | null;
}

export interface AccountRecord extends AccountInput {
  id: string;
  color: string;
  startingBalance?: number | null;
  currentBalance?: number | null;
  profitTarget?: number | null;
  maxDrawdown?: number | null;
  dailyLossLimit?: number | null;
  createdAt: string;
  updatedAt: string;
  tradeCount?: number;
  totalPnl?: number;
}

export interface TradeInput {
  accountId: string;
  tradeDate: string;
  instrument: Instrument;
  model: Model;
  direction: Direction;
  entryType: EntryType;
  setupQuality: SetupQuality;
  session: Session;
  confirmations: string[];
  mistakes: MistakeTag[];
  entryPrice?: number | null;
  exitPrice?: number | null;
  stopPrice?: number | null;
  targetPrice?: number | null;
  contracts: number;
  pnlDollars: number;
  pnlR?: number | null;
  notes?: string | null;
  screenshots?: string[];
}

export interface TradeRecord extends TradeInput {
  id: string;
  accountName?: string;
  accountFirm?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupStats {
  trades: number;
  pnl: number;
  winRate: number;
}

export interface TradeStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
  avgR: number;
  bestTrade: number;
  worstTrade: number;
  byInstrument: Record<string, GroupStats>;
  byModel: Record<string, GroupStats>;
  byEntryType: Record<string, GroupStats>;
  byQuality: Record<string, GroupStats>;
  byAccount: Record<string, GroupStats & { name: string; firm: string }>;
  dailyPnl: { date: string; pnl: number; trades: number }[];
  recentTrades: TradeRecord[];
}
