import { TradeForm } from "@/components/TradeForm";
import { prisma } from "@/lib/prisma";
import { toAccountRecord } from "@/lib/account-utils";
import { ensureAccountsReady } from "@/lib/accounts";

export default async function NewTradePage() {
  await ensureAccountsReady();
  const accountsRaw = await prisma.account.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { trades: true } }, trades: { select: { pnlDollars: true } } },
  });
  const accounts = accountsRaw.map(toAccountRecord);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Новая сделка</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Выбери аккаунт → модель → чеклист → AOI
        </p>
      </div>
      <TradeForm accounts={accounts} />
    </div>
  );
}
