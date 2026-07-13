"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

interface BalanceSyncProps {
  accountId: string;
  accountName: string;
  currentBalance: number | null;
}

export function BalanceSync({ accountId, accountName, currentBalance }: BalanceSyncProps) {
  const router = useRouter();
  const [balance, setBalance] = useState(currentBalance?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSync(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/accounts/${accountId}/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance: parseFloat(balance) }),
    });
    if (res.ok) {
      router.refresh();
      setOpen(false);
    }
    setSaving(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-white"
      >
        <RefreshCw size={12} />
        Обновить баланс
      </button>
    );
  }

  return (
    <form onSubmit={handleSync} className="mt-3 rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
      <p className="text-xs text-zinc-500">Баланс {accountName} сейчас</p>
      <div className="mt-2 flex gap-2">
        <input
          className="input flex-1 text-sm"
          type="number"
          step="0.01"
          placeholder="50000"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "..." : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:text-white"
        >
          ✕
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-zinc-600">
        Введи баланс из Lucid dashboard после сессии — приложение обновит прогресс к цели
      </p>
    </form>
  );
}
