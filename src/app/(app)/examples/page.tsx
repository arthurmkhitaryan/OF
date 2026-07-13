import { ExamplesContent } from "@/components/examples/ExamplesContent";

export default function ExamplesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Examples</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Оригинальные графики из TradeZella playbook (Yush Order Flow Strategy)
        </p>
      </div>
      <ExamplesContent />
    </div>
  );
}
