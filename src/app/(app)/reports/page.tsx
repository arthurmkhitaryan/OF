import { format, subMonths } from "date-fns";
import { getMonthlyReport } from "@/lib/reports";
import { ensureAccountsReady } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { MonthlyReportView } from "@/components/MonthlyReportView";
import { ReportMonthPicker } from "@/components/ReportMonthPicker";

interface Props {
  searchParams: Promise<{ month?: string; accountId?: string }>;
}

export default async function ReportsPage({ searchParams }: Props) {
  await ensureAccountsReady();
  const params = await searchParams;

  const now = new Date();
  const month = params.month ?? format(now, "yyyy-MM");
  const accountId = params.accountId ?? "all";

  const [year, m] = month.split("-").map(Number);
  const report = await getMonthlyReport(year, m, accountId === "all" ? null : accountId);

  const accounts = await prisma.account.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const prevMonth = format(subMonths(new Date(year, m - 1), 1), "yyyy-MM");
  const nextMonth = format(subMonths(new Date(year, m - 1), -1), "yyyy-MM");
  const isCurrentMonth = month === format(now, "yyyy-MM");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Отчёты</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Ежемесячный бизнес-отчёт: P&L, ошибки, рекомендации
          </p>
        </div>
        <ReportMonthPicker
          month={month}
          accountId={accountId}
          accounts={accounts}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
          isCurrentMonth={isCurrentMonth}
        />
      </div>

      <MonthlyReportView report={report} />
    </div>
  );
}
