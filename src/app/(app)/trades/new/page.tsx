import { TradeForm } from "@/components/TradeForm";
import { prisma } from "@/lib/prisma";
import { toAccountRecord } from "@/lib/account-utils";
import { ensureAccountsReady } from "@/lib/accounts";
import type { TradeInput } from "@/lib/types";

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function NewTradePage({ searchParams }: Props) {
  await ensureAccountsReady();
  const params = await searchParams;

  const accountsRaw = await prisma.account.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { trades: true } }, trades: { select: { pnlDollars: true } } },
  });
  const accounts = accountsRaw.map(toAccountRecord);

  const initial = params.fromSignal === "1" ? signalToInitial(params) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Новая сделка</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {initial
            ? "Презаполнено из Live сигнала — проверь чеклист и сохрани"
            : "Выбери аккаунт → модель → чеклист → AOI"}
        </p>
      </div>
      <TradeForm accounts={accounts} initial={initial} />
    </div>
  );
}

function signalToInitial(params: Record<string, string | undefined>): Partial<TradeInput> {
  const model = params.model === "TREND" ? "TREND" : "RANGE";
  const direction = params.direction === "SHORT" ? "SHORT" : "LONG";
  const instrument = params.instrument === "ES" ? "ES" : "NQ";
  const quality = (["A_PLUS", "A", "B", "C"] as const).includes(
    params.setupQuality as "A_PLUS" | "A" | "B" | "C"
  )
    ? (params.setupQuality as TradeInput["setupQuality"])
    : "B";

  const contracts = params.contracts ? parseInt(params.contracts, 10) : 1;

  return {
    instrument,
    model,
    direction,
    setupQuality: quality,
    entryType: "CONFIRMATION",
    entryPrice: num(params.entryPrice),
    stopPrice: num(params.stopPrice),
    targetPrice: num(params.targetPrice),
    contracts: Number.isFinite(contracts) && contracts > 0 ? contracts : 1,
    notes: params.notes ?? "",
    confirmations: ["live_signal"],
  };
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
