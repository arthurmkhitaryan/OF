"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROP_FIRMS, ACCOUNT_TYPES, ACCOUNT_STATUSES, ACCOUNT_LABELS } from "@/lib/account-constants";
import type { AccountInput } from "@/lib/types";

const COLORS = ["#34d399", "#60a5fa", "#a78bfa", "#fbbf24", "#f87171", "#fb923c"];

const SIZE_DEFAULTS: Record<number, Partial<AccountInput>> = {
  50: {
    startingBalance: 50000,
    currentBalance: 50000,
    profitTarget: 3000,
    maxDrawdown: 2500,
    dailyLossLimit: 1100,
  },
  100: {
    startingBalance: 100000,
    currentBalance: 100000,
    profitTarget: 6000,
    maxDrawdown: 3000,
    dailyLossLimit: 2200,
  },
  150: {
    startingBalance: 150000,
    currentBalance: 150000,
    profitTarget: 9000,
    maxDrawdown: 4500,
    dailyLossLimit: 3300,
  },
};

export function AccountForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AccountInput>({
    name: "",
    firm: "Lucid",
    type: "EVAL",
    status: "ACTIVE",
    size: null,
    notes: "",
    color: "#34d399",
  });

  function applySizeDefaults(size: number | null) {
    if (size && SIZE_DEFAULTS[size]) {
      setForm((f) => ({ ...f, size, ...SIZE_DEFAULTS[size] }));
    } else {
      setForm((f) => ({ ...f, size }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      router.refresh();
      setForm({ name: "", firm: "Lucid", type: "EVAL", status: "ACTIVE", size: null, notes: "", color: "#34d399" });
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="text-sm font-semibold text-white">Добавить аккаунт</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Название">
          <input
            className="input"
            placeholder="LucidFlex #2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </Field>
        <Field label="Prop Firm">
          <select
            className="input"
            value={form.firm}
            onChange={(e) => setForm({ ...form, firm: e.target.value })}
          >
            {PROP_FIRMS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Field>
        <Field label="Тип">
          <select
            className="input"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as AccountInput["type"] })}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>{ACCOUNT_LABELS[t]}</option>
            ))}
          </select>
        </Field>
        <Field label="Статус">
          <select
            className="input"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as AccountInput["status"] })}
          >
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s} value={s}>{ACCOUNT_LABELS[s]}</option>
            ))}
          </select>
        </Field>
        <Field label="Размер ($K)">
          <select
            className="input"
            value={form.size ?? ""}
            onChange={(e) => applySizeDefaults(e.target.value ? +e.target.value : null)}
          >
            <option value="">—</option>
            <option value="50">50K</option>
            <option value="100">100K</option>
            <option value="150">150K</option>
          </select>
        </Field>
        <Field label="Цвет">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, color: c })}
                className={`h-8 w-8 rounded-full border-2 ${form.color === c ? "border-white" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>
      </div>

      {form.size && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Начальный баланс ($)">
            <input
              className="input"
              type="number"
              value={form.startingBalance ?? ""}
              onChange={(e) => setForm({ ...form, startingBalance: e.target.value ? +e.target.value : null })}
            />
          </Field>
          <Field label="Цель ($)">
            <input
              className="input"
              type="number"
              value={form.profitTarget ?? ""}
              onChange={(e) => setForm({ ...form, profitTarget: e.target.value ? +e.target.value : null })}
            />
          </Field>
          <Field label="Макс. просадка ($)">
            <input
              className="input"
              type="number"
              value={form.maxDrawdown ?? ""}
              onChange={(e) => setForm({ ...form, maxDrawdown: e.target.value ? +e.target.value : null })}
            />
          </Field>
          <Field label="Дневной лимит ($)">
            <input
              className="input"
              type="number"
              value={form.dailyLossLimit ?? ""}
              onChange={(e) => setForm({ ...form, dailyLossLimit: e.target.value ? +e.target.value : null })}
            />
          </Field>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {saving ? "..." : "Добавить"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
