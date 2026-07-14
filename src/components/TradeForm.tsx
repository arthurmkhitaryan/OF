"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ENTRY_TYPES,
  INSTRUMENTS,
  LABELS,
  MISTAKE_TAGS,
  MODELS,
  SESSIONS,
  SETUP_QUALITIES,
  DIRECTIONS,
} from "@/lib/constants";
import { AOI_LEVELS, getRequiredChecklistKeys } from "@/lib/playbook";
import { StrategyPlaybook } from "@/components/StrategyPlaybook";
import type { MistakeTag, TradeInput, AccountRecord } from "@/lib/types";
import { Upload, X } from "lucide-react";
import { useEffect } from "react";

const defaultForm: TradeInput = {
  accountId: "",
  tradeDate: new Date().toISOString().slice(0, 10),
  instrument: "NQ",
  model: "RANGE",
  direction: "LONG",
  entryType: "CONFIRMATION",
  setupQuality: "A",
  session: "RTH",
  confirmations: [],
  mistakes: [],
  contracts: 1,
  pnlDollars: 0,
  notes: "",
  screenshots: [],
};

interface TradeFormProps {
  initial?: Partial<TradeInput>;
  tradeId?: string;
  accounts?: AccountRecord[];
}

export function TradeForm({ initial, tradeId, accounts = [] }: TradeFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<TradeInput>({
    ...defaultForm,
    ...initial,
    confirmations: initial?.confirmations ?? defaultForm.confirmations,
    mistakes: initial?.mistakes ?? defaultForm.mistakes,
    screenshots: initial?.screenshots ?? [],
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!form.accountId && accounts.length > 0) {
      const active = accounts.find((a) => a.status === "ACTIVE") ?? accounts[0];
      setForm((prev) => ({ ...prev, accountId: active.id }));
    }
  }, [accounts, form.accountId]);

  function update<K extends keyof TradeInput>(key: K, value: TradeInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleConfirmation(key: string) {
    const list = form.confirmations.includes(key)
      ? form.confirmations.filter((c) => c !== key)
      : [...form.confirmations, key];
    update("confirmations", list);
  }

  function toggleMistake(key: MistakeTag) {
    const list = form.mistakes.includes(key)
      ? form.mistakes.filter((m) => m !== key)
      : [...form.mistakes, key];
    update("mistakes", list);
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const paths: string[] = [];

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        paths.push(data.path);
      }
    }

    update("screenshots", [...(form.screenshots ?? []), ...paths]);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const requiredKeys = getRequiredChecklistKeys(form.model);
    const missingRequired = requiredKeys.filter((k) => !form.confirmations.includes(k));
    const aoiKeys = AOI_LEVELS.map((l) => l.key);
    const aoiCount = form.confirmations.filter((c) => aoiKeys.includes(c)).length;

    if (missingRequired.length > 0) {
      setError(`Отметь обязательные пункты чеклиста (${missingRequired.length} осталось)`);
      setSaving(false);
      return;
    }

    if (aoiCount < 2) {
      setError("Минимум 2 уровня AOI на сетапе");
      setSaving(false);
      return;
    }

    const url = tradeId ? `/api/trades/${tradeId}` : "/api/trades";
    const method = tradeId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      setError("Ошибка сохранения");
      setSaving(false);
      return;
    }

    router.push("/trades");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Основное
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Аккаунт">
            <select
              value={form.accountId}
              onChange={(e) => update("accountId", e.target.value)}
              className="input"
              required
            >
              {accounts.length === 0 && <option value="">Загрузка...</option>}
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.firm})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Дата">
            <input
              type="date"
              value={form.tradeDate}
              onChange={(e) => update("tradeDate", e.target.value)}
              className="input"
              required
            />
          </Field>
          <Field label="Инструмент">
            <select
              value={form.instrument}
              onChange={(e) => update("instrument", e.target.value as TradeInput["instrument"])}
              className="input"
            >
              {INSTRUMENTS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Сессия">
            <select
              value={form.session}
              onChange={(e) => update("session", e.target.value as TradeInput["session"])}
              className="input"
            >
              {SESSIONS.map((v) => (
                <option key={v} value={v}>{LABELS[v]}</option>
              ))}
            </select>
          </Field>
          <Field label="Модель">
            <select
              value={form.model}
              onChange={(e) => update("model", e.target.value as TradeInput["model"])}
              className="input"
            >
              {MODELS.map((v) => (
                <option key={v} value={v}>{LABELS[v]}</option>
              ))}
            </select>
          </Field>
          <Field label="Направление">
            <select
              value={form.direction}
              onChange={(e) => update("direction", e.target.value as TradeInput["direction"])}
              className="input"
            >
              {DIRECTIONS.map((v) => (
                <option key={v} value={v}>{LABELS[v]}</option>
              ))}
            </select>
          </Field>
          <Field label="Тип входа">
            <select
              value={form.entryType}
              onChange={(e) => update("entryType", e.target.value as TradeInput["entryType"])}
              className="input"
            >
              {ENTRY_TYPES.map((v) => (
                <option key={v} value={v}>{LABELS[v]}</option>
              ))}
            </select>
          </Field>
          <Field label="Качество сетапа">
            <select
              value={form.setupQuality}
              onChange={(e) => update("setupQuality", e.target.value as TradeInput["setupQuality"])}
              className="input"
            >
              {SETUP_QUALITIES.map((v) => (
                <option key={v} value={v}>{LABELS[v]}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <StrategyPlaybook
        model={form.model}
        confirmations={form.confirmations}
        onToggle={toggleConfirmation}
        onModelChange={(model) => update("model", model)}
      />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Цены и результат
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Entry">
            <input
              type="number"
              step="0.25"
              value={form.entryPrice ?? ""}
              onChange={(e) => update("entryPrice", e.target.value ? +e.target.value : null)}
              className="input"
            />
          </Field>
          <Field label="Exit">
            <input
              type="number"
              step="0.25"
              value={form.exitPrice ?? ""}
              onChange={(e) => update("exitPrice", e.target.value ? +e.target.value : null)}
              className="input"
            />
          </Field>
          <Field label="Stop">
            <input
              type="number"
              step="0.25"
              value={form.stopPrice ?? ""}
              onChange={(e) => update("stopPrice", e.target.value ? +e.target.value : null)}
              className="input"
            />
          </Field>
          <Field label="Target">
            <input
              type="number"
              step="0.25"
              value={form.targetPrice ?? ""}
              onChange={(e) => update("targetPrice", e.target.value ? +e.target.value : null)}
              className="input"
            />
          </Field>
          <Field label="Контракты">
            <input
              type="number"
              min={1}
              value={form.contracts}
              onChange={(e) => update("contracts", +e.target.value)}
              className="input"
              required
            />
          </Field>
          <Field label="P&L ($)">
            <input
              type="number"
              step="0.01"
              value={form.pnlDollars}
              onChange={(e) => update("pnlDollars", +e.target.value)}
              className="input"
              required
            />
          </Field>
          <Field label="P&L (R)">
            <input
              type="number"
              step="0.1"
              value={form.pnlR ?? ""}
              onChange={(e) => update("pnlR", e.target.value ? +e.target.value : null)}
              className="input"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Ошибки / теги
        </h2>
        <div className="flex flex-wrap gap-2">
          {MISTAKE_TAGS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleMistake(key)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                form.mistakes.includes(key)
                  ? "border-red-700 bg-red-950 text-red-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {LABELS[key]}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Заметки
        </h2>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
          rows={4}
          placeholder="Что видел на DOM / footprint / volume profile..."
          className="input w-full resize-y"
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Скриншоты
        </h2>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-4 py-6 text-sm text-zinc-400 hover:border-emerald-600 hover:text-emerald-400">
          <Upload size={18} />
          {uploading ? "Загрузка..." : "Загрузить скриншоты (DOM, footprint, chart)"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </label>
        {form.screenshots && form.screenshots.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {form.screenshots.map((src) => (
              <div key={src} className="relative overflow-hidden rounded-lg border border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Screenshot" className="h-40 w-full object-cover" />
                <button
                  type="button"
                  onClick={() =>
                    update(
                      "screenshots",
                      form.screenshots!.filter((s) => s !== src)
                    )
                  }
                  className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white hover:bg-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : tradeId ? "Обновить" : "Сохранить сделку"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm text-zinc-400 hover:text-white"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
