export default function GexLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">GEX уровни</h1>
        <p className="mt-1 text-sm text-zinc-500">Загрузка данных с CBOE…</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
        <div className="h-80 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
      </div>
    </div>
  );
}
