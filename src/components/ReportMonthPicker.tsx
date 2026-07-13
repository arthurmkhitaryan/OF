"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  month: string;
  accountId: string;
  accounts: { id: string; name: string }[];
  prevMonth: string;
  nextMonth: string;
  isCurrentMonth: boolean;
}

export function ReportMonthPicker({
  month,
  accountId,
  accounts,
  prevMonth,
  nextMonth,
  isCurrentMonth,
}: Props) {
  const router = useRouter();

  function navigate(newMonth: string, newAccountId?: string) {
    const params = new URLSearchParams();
    params.set("month", newMonth);
    params.set("accountId", newAccountId ?? accountId);
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        className="input text-sm"
        value={accountId}
        onChange={(e) => navigate(month, e.target.value)}
      >
        <option value="all">Все счета</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40">
        <button
          type="button"
          onClick={() => navigate(prevMonth)}
          className="rounded-l-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-[100px] px-2 text-center text-sm text-white">{month}</span>
        <button
          type="button"
          onClick={() => !isCurrentMonth && navigate(nextMonth)}
          disabled={isCurrentMonth}
          className="rounded-r-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
