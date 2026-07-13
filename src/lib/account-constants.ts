export const ACCOUNT_TYPES = ["EVAL", "FUNDED"] as const;
export const ACCOUNT_STATUSES = ["ACTIVE", "PAUSED", "PASSED", "FAILED"] as const;
export const PROP_FIRMS = [
  "Lucid",
  "Apex",
  "Tradeify",
  "Topstep",
  "TPT",
  "FundedNext",
  "Other",
] as const;

export const ACCOUNT_LABELS: Record<string, string> = {
  EVAL: "Evaluation",
  FUNDED: "Funded",
  ACTIVE: "Активный",
  PAUSED: "На паузе",
  PASSED: "Пройден",
  FAILED: "Слит",
};
