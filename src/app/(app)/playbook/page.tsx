import { StrategyPlaybookStatic } from "@/components/StrategyPlaybookStatic";

export default function PlaybookPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Order Flow Playbook</h1>
        <p className="mt-1 text-sm text-zinc-500">
          NQ & ES · Range & Trend модели · Yush Order Flow Strategy
        </p>
      </div>
      <StrategyPlaybookStatic />
    </div>
  );
}
