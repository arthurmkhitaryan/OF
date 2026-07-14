import { LiveWorkspace } from "@/components/live/LiveWorkspace";

export default function LivePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Live Chart</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Авто-разметка VP / LVN / GEX + сигналы Model 1 Range и Model 2 Trend
        </p>
      </div>
      <LiveWorkspace />
    </div>
  );
}
