"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { AccountRecord } from "@/lib/types";

interface AccountFilterProps {
  accounts: AccountRecord[];
  className?: string;
}

export function AccountFilter({ accounts, className }: AccountFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("account") ?? "all";

  function setAccount(accountId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (accountId === "all") {
      params.delete("account");
    } else {
      params.set("account", accountId);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      <FilterButton
        active={current === "all"}
        onClick={() => setAccount("all")}
        label="Все счета"
        color="#a1a1aa"
      />
      {accounts.map((acc) => (
        <FilterButton
          key={acc.id}
          active={current === acc.id}
          onClick={() => setAccount(acc.id)}
          label={acc.name}
          sub={acc.firm}
          color={acc.color}
        />
      ))}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  sub,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
        active
          ? "border-zinc-600 bg-zinc-800 text-white"
          : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700"
      }`}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
      {sub && <span className="text-xs text-zinc-600">{sub}</span>}
    </button>
  );
}
