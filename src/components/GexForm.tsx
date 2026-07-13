"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GEX_SOURCES, type GexInstrument, type GexSnapshotRecord } from "@/lib/gex";

interface Props {
  date: string;
  instrument: GexInstrument;
  initial: GexSnapshotRecord | null;
}

export function GexForm({ date, instrument, initial }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    spot: initial?.spot?.toString() ?? "",
    zeroGamma: initial?.zeroGamma?.toString() ?? "",
    callWall: initial?.callWall?.toString() ?? "",
    putWall: initial?.putWall?.toString() ?? "",
    hvl: initial?.hvl?.toString() ?? "",
    source: initial?.source ?? "CBOE",
    notes: initial?.notes ?? "",
  });

  function num(v: string): number | null {
    if (v.trim() === "") return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/gex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        instrument,
        spot: num(form.spot),
        zeroGamma: num(form.zeroGamma),
        callWall: num(form.callWall),
        putWall: num(form.putWall),
        hvl: num(form.hvl),
        source: form.source || null,
        notes: form.notes || null,
      }),
    });
    setSaving(false);
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-zinc-800 pt-4">
      <p className="text-xs font-medium text-zinc-400">Обновить уровни {instrument}</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Spot">
          <input
            className="input"
            type="number"
            step="any"
            value={form.spot}
            onChange={(e) => setForm({ ...form, spot: e.target.value })}
            placeholder="21500"
          />
        </Field>
        <Field label="Zero Gamma">
          <input
            className="input"
            type="number"
            step="any"
            value={form.zeroGamma}
            onChange={(e) => setForm({ ...form, zeroGamma: e.target.value })}
          />
        </Field>
        <Field label="Call Wall">
          <input
            className="input"
            type="number"
            step="any"
            value={form.callWall}
            onChange={(e) => setForm({ ...form, callWall: e.target.value })}
          />
        </Field>
        <Field label="Put Wall">
          <input
            className="input"
            type="number"
            step="any"
            value={form.putWall}
            onChange={(e) => setForm({ ...form, putWall: e.target.value })}
          />
        </Field>
        <Field label="HVL">
          <input
            className="input"
            type="number"
            step="any"
            value={form.hvl}
            onChange={(e) => setForm({ ...form, hvl: e.target.value })}
          />
        </Field>
        <Field label="Источник">
          <select
            className="input"
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
          >
            {GEX_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Заметки">
        <textarea
          className="input min-h-[60px] resize-y"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Positive gamma day / caution below flip…"
        />
      </Field>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {saving ? "Сохранение…" : "Сохранить"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
