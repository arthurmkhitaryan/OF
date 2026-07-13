import { format } from "date-fns";
import { getGexForDate, ensureTodayGexFresh } from "@/lib/gex-queries";
import { GexInstrumentPanel } from "@/components/GexInstrumentPanel";
import { GexDatePicker } from "@/components/GexDatePicker";
import { GexRefreshButton } from "@/components/GexRefreshButton";

type Props = { searchParams: Promise<{ date?: string }> };

export default async function GexPage({ searchParams }: Props) {
  const { date: dateParam } = await searchParams;
  const today = format(new Date(), "yyyy-MM-dd");
  const date = dateParam ?? today;
  const isToday = date === today;

  let NQ = null as Awaited<ReturnType<typeof getGexForDate>>["NQ"];
  let ES = null as Awaited<ReturnType<typeof getGexForDate>>["ES"];
  let autoRefreshed = false;
  let autoError: string | undefined;

  if (isToday) {
    const fresh = await ensureTodayGexFresh();
    NQ = fresh.NQ;
    ES = fresh.ES;
    autoRefreshed = fresh.autoRefreshed;
    autoError = fresh.error;
  } else {
    const gex = await getGexForDate(date);
    NQ = gex.NQ;
    ES = gex.ES;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">GEX уровни</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Авто с CBOE delayed: ES ← SPX, NQ ← QQQ (скейл на NDX). Стены = net GEX ±2.5%
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <GexDatePicker date={date} />
          {isToday && <GexRefreshButton date={date} />}
        </div>
      </div>

      {autoRefreshed ? (
        <p className="rounded-lg border border-sky-900/50 bg-sky-950/30 px-3 py-2 text-xs text-sky-300">
          Уровни только что обновлены с CBOE delayed quotes.
        </p>
      ) : null}
      {autoError ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          Не удалось автозагрузить CBOE: {autoError}. Нажми «Обновить с CBOE» или введи вручную.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <GexInstrumentPanel date={date} instrument="NQ" snapshot={NQ} />
        <GexInstrumentPanel date={date} instrument="ES" snapshot={ES} />
      </div>
    </div>
  );
}
