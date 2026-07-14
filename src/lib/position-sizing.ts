import type { LiveInstrument, LiveSignal } from "./market-types";

/** CME full-size point values ($) */
export const POINT_VALUE: Record<LiveInstrument, number> = {
  NQ: 20,
  ES: 50,
};

/** Micro alternatives for comparison */
export const MICRO_POINT_VALUE: Record<LiveInstrument, number> = {
  NQ: 2, // MNQ
  ES: 5, // MES
};

export const RISK_PCT_OF_MAX_DD = 0.1; // 10% от макс. просадки аккаунта

export interface AccountRiskInput {
  id: string;
  name: string;
  maxDrawdown: number | null;
  size?: number | null;
}

export interface PositionPlan {
  accountId: string;
  accountName: string;
  maxDrawdown: number;
  riskBudget: number;
  riskPctOfDd: number;
  instrument: LiveInstrument;
  pointValue: number;
  microPointValue: number;
  entry: number;
  stop: number;
  take: number;
  stopPoints: number;
  takePoints: number;
  contracts: number;
  microContracts: number;
  riskPerContract: number;
  rewardPerContract: number;
  rewardRisk: number;
  note: string;
}

/**
 * Risk = 10% of account maxDrawdown (e.g. DD $2000 → risk $200).
 * Stop from signal; Take = 2R (или ближний target сигнала, если ≥ 1.5R).
 */
export function buildPositionPlan(
  instrument: LiveInstrument,
  signal: LiveSignal,
  account: AccountRiskInput,
  rewardMultiple = 2
): PositionPlan | null {
  if (
    signal.entryZone == null ||
    signal.stop == null ||
    !signal.direction ||
    signal.status === "NO_TRADE"
  ) {
    return null;
  }

  const maxDrawdown =
    account.maxDrawdown && account.maxDrawdown > 0
      ? account.maxDrawdown
      : account.size
        ? account.size * 1000 * 0.04 // fallback ~4% of size if DD missing (50k→2k)
        : 2000;

  const riskBudget = maxDrawdown * RISK_PCT_OF_MAX_DD;
  const entry = signal.entryZone;
  const stop = signal.stop;
  const stopPoints = Math.abs(entry - stop);

  if (stopPoints < 0.25) return null;

  const pointValue = POINT_VALUE[instrument];
  const microPointValue = MICRO_POINT_VALUE[instrument];
  const riskPerContract = stopPoints * pointValue;
  const contracts = Math.max(0, Math.floor(riskBudget / riskPerContract));
  const microContracts = Math.max(0, Math.floor(riskBudget / (stopPoints * microPointValue)));

  const takeByR =
    signal.direction === "LONG"
      ? entry + stopPoints * rewardMultiple
      : entry - stopPoints * rewardMultiple;

  // Prefer signal TP1 if it gives at least 1.5R
  let take = takeByR;
  const tp1 = signal.targets[0];
  if (tp1 != null) {
    const tpPoints = Math.abs(tp1 - entry);
    if (tpPoints >= stopPoints * 1.5) take = tp1;
  }

  const takePoints = Math.abs(take - entry);
  const rewardPerContract = takePoints * pointValue;
  const rewardRisk = riskPerContract > 0 ? rewardPerContract / riskPerContract : 0;

  const microName = instrument === "NQ" ? "MNQ" : "MES";
  const note =
    contracts > 0
      ? `${instrument}: ${contracts} контракт(а), стоп ${stopPoints.toFixed(2)} пт (~$${riskPerContract.toFixed(0)}/контракт), риск ≤ $${riskBudget.toFixed(0)}`
      : `Стоп слишком широкий для полного ${instrument} при риске $${riskBudget.toFixed(0)}. Используй ${microName}: ${microContracts} микро.`;

  return {
    accountId: account.id,
    accountName: account.name,
    maxDrawdown,
    riskBudget,
    riskPctOfDd: RISK_PCT_OF_MAX_DD,
    instrument,
    pointValue,
    microPointValue,
    entry: round2(entry),
    stop: round2(stop),
    take: round2(take),
    stopPoints: round2(stopPoints),
    takePoints: round2(takePoints),
    contracts,
    microContracts,
    riskPerContract: round2(riskPerContract),
    rewardPerContract: round2(rewardPerContract),
    rewardRisk: round2(rewardRisk),
    note,
  };
}

export function buildPlansForAccounts(
  instrument: LiveInstrument,
  signal: LiveSignal,
  accounts: AccountRiskInput[]
): PositionPlan[] {
  return accounts
    .map((a) => buildPositionPlan(instrument, signal, a))
    .filter((p): p is PositionPlan => p != null);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
