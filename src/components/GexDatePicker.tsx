"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, parseISO } from "date-fns";

interface Props {
  date: string;
}

export function GexDatePicker({ date }: Props) {
  const router = useRouter();
  const today = format(new Date(), "yyyy-MM-dd");
  const isToday = date === today;

  function go(delta: number) {
    const next = format(addDays(parseISO(date), delta), "yyyy-MM-dd");
    router.push(`/gex?date=${next}`);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) router.push(`/gex?date=${e.target.value}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/40">
        <button
          type="button"
          onClick={() => go(-1)}
          className="rounded-l-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={16} />
        </button>
        <input
          type="date"
          value={date}
          onChange={onChange}
          className="bg-transparent px-2 py-1.5 text-sm text-white outline-none [color-scheme:dark]"
        />
        <button
          type="button"
          onClick={() => go(1)}
          disabled={isToday}
          className="rounded-r-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {!isToday && (
        <button
          type="button"
          onClick={() => router.push(`/gex?date=${today}`)}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
        >
          Сегодня
        </button>
      )}
    </div>
  );
}
