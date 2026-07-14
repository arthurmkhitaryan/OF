export default function LiveLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Live Chart</h1>
        <p className="mt-1 text-sm text-zinc-500">Загрузка рынка…</p>
      </div>
      <div className="h-80 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
    </div>
  );
}
