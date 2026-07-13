import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { toTradeRecord } from "@/lib/trade-utils";
import { splitConfirmations, getItemLabel } from "@/lib/playbook";
import { LABELS } from "@/lib/constants";
import { formatPnl, formatR } from "@/lib/trade-utils";
import { cn } from "@/lib/cn";
import { TradeForm } from "@/components/TradeForm";
import { DeleteTradeButton } from "@/components/DeleteTradeButton";
import { toAccountRecord } from "@/lib/account-utils";
import { ensureAccountsReady } from "@/lib/accounts";

type Params = { params: Promise<{ id: string }> };

export default async function TradeDetailPage({ params }: Params) {
  await ensureAccountsReady();
  const { id } = await params;
  const trade = await prisma.trade.findUnique({
    where: { id },
    include: { account: { select: { name: true, firm: true } } },
  });
  if (!trade) notFound();

  const accountsRaw = await prisma.account.findMany({
    include: { _count: { select: { trades: true } }, trades: { select: { pnlDollars: true } } },
  });
  const accounts = accountsRaw.map(toAccountRecord);

  const record = toTradeRecord(trade);

  const { checklist, aoi } = splitConfirmations(record.confirmations, record.model);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/trades" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Назад к сделкам
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            {record.instrument} · {LABELS[record.direction]} · {LABELS[record.model]}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {format(new Date(record.tradeDate), "d MMMM yyyy", { locale: ru })} ·{" "}
            {record.accountName} · {LABELS[record.entryType]} · {LABELS[record.setupQuality]}
          </p>
        </div>
        <div className="flex gap-2">
          <DeleteTradeButton id={record.id} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Metric
          label="P&L"
          value={formatPnl(record.pnlDollars)}
          positive={record.pnlDollars >= 0}
        />
        <Metric label="R" value={formatR(record.pnlR)} />
        <Metric label="Контракты" value={String(record.contracts)} />
        <Metric label="Сессия" value={LABELS[record.session]} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <InfoBlock title="Цены">
          <InfoRow label="Entry" value={record.entryPrice} />
          <InfoRow label="Exit" value={record.exitPrice} />
          <InfoRow label="Stop" value={record.stopPrice} />
          <InfoRow label="Target" value={record.targetPrice} />
        </InfoBlock>

        <InfoBlock title="Чеклист модели">
          {checklist.length > 0 ? (
            <ul className="space-y-1">
              {checklist.map((key) => (
                <li key={key} className="text-sm text-emerald-400">
                  ✓ {getItemLabel(key)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">—</p>
          )}
        </InfoBlock>
      </div>

      {aoi.length > 0 && (
        <InfoBlock title="AOI уровни">
          <div className="flex flex-wrap gap-2">
            {aoi.map((key) => (
              <span
                key={key}
                className="rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-300"
              >
                {getItemLabel(key)}
              </span>
            ))}
          </div>
        </InfoBlock>
      )}

      {record.mistakes.length > 0 && (
        <InfoBlock title="Ошибки">
          <div className="flex flex-wrap gap-2">
            {record.mistakes.map((m) => (
              <span
                key={m}
                className="rounded-full border border-red-800 bg-red-950 px-3 py-1 text-xs text-red-300"
              >
                {LABELS[m]}
              </span>
            ))}
          </div>
        </InfoBlock>
      )}

      {record.notes && (
        <InfoBlock title="Заметки">
          <p className="whitespace-pre-wrap text-sm text-zinc-300">{record.notes}</p>
        </InfoBlock>
      )}

      {(record.screenshots?.length ?? 0) > 0 && (
        <InfoBlock title="Скриншоты">
          <div className="grid gap-4 sm:grid-cols-2">
            {record.screenshots!.map((src) => (
              <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt="Trade screenshot"
                  className="w-full rounded-lg border border-zinc-800 object-cover"
                />
              </a>
            ))}
          </div>
        </InfoBlock>
      )}

      <div className="border-t border-zinc-800 pt-8">
        <h2 className="mb-6 text-lg font-semibold text-white">Редактировать</h2>
        <TradeForm
          tradeId={record.id}
          accounts={accounts}
          initial={{
            ...record,
            tradeDate: record.tradeDate.slice(0, 10),
          }}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          positive === true && "text-emerald-400",
          positive === false && "text-red-400",
          positive === undefined && "text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="mb-3 text-sm font-semibold text-zinc-400">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="tabular-nums text-zinc-200">{value ?? "—"}</span>
    </div>
  );
}
