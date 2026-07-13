import { cn } from "@/lib/cn";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}

export function StatCard({ label, value, sub, positive }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          positive === true && "text-emerald-400",
          positive === false && "text-red-400",
          positive === undefined && "text-white"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}
