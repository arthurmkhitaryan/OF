import {
  AOI_LEVELS,
  MARKET_CONDITION_SIGNS,
  RANGE_CHECKLIST,
  TREND_CHECKLIST,
} from "@/lib/playbook";
import { Info } from "lucide-react";

export function StrategyPlaybookStatic() {
  return (
    <div className="space-y-8">
      {/* Balanced vs Imbalanced */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">
          Как понять: Balanced или Imbalanced?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Это первое, что определяешь утром. Открой Volume Profile (session или composite)
          и наблюдай 30–60 минут после открытия RTH. Не выбирай модель заранее — рынок сам
          покажет, balanced он или imbalanced.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <StaticConditionCard type="balanced" />
          <StaticConditionCard type="imbalanced" />
        </div>

        <div className="mt-6 rounded-lg border border-amber-800/50 bg-amber-950/20 px-4 py-3">
          <p className="text-sm text-amber-200">
            <strong>Правило:</strong> если сомневаешься — скорее всего это balanced (range).
            В range не торгуй breakout. В trend не фейди движение. Неверная модель = тег
            «wrong_model» в журнале.
          </p>
        </div>
      </section>

      {/* Model 1 */}
      <section className="rounded-xl border border-blue-800/40 bg-zinc-900/40 p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-blue-950 px-3 py-1 text-xs font-medium text-blue-300">
            Model 1
          </span>
          <h2 className="text-lg font-semibold text-white">Range — Balanced Market</h2>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Рынок ротирует: buyers и sellers активны, но никто не контролирует полностью.
          Цена ходит туда-сюда внутри Value Area. Большинство теряют деньги, пытаясь торговать
          брейкауты, которые не работают. Твоя задача — торговать <em>только края</em>.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <InfoBox title="Где входить">
            <ul className="space-y-1 text-sm text-zinc-400">
              <li>• <strong className="text-zinc-200">VAH</strong> — short (resistance)</li>
              <li>• <strong className="text-zinc-200">VAL</strong> — long (support)</li>
              <li>• Середина range = NO TRADE</li>
            </ul>
          </InfoBox>
          <InfoBox title="Что искать на краю">
            <ul className="space-y-1 text-sm text-zinc-400">
              <li>• Absorption — delta большая, цена стоит</li>
              <li>• Big trades не двигают цену</li>
              <li>• Look above/below and fail</li>
              <li>• Trapped breakout traders</li>
            </ul>
          </InfoBox>
          <InfoBox title="Типы входа">
            <ul className="space-y-1 text-sm text-zinc-400">
              <li>• <strong className="text-zinc-200">Aggressive</strong> — на краю при первых признаках rejection (меньший размер)</li>
              <li>• <strong className="text-zinc-200">Confirmation</strong> — после trap: брейкаут → возврат → rejection</li>
            </ul>
          </InfoBox>
          <InfoBox title="Управление">
            <ul className="space-y-1 text-sm text-zinc-400">
              <li>• TP1: midpoint range → стоп в BE</li>
              <li>• TP2: противоположный край value</li>
              <li>• Стоп за краем диапазона (tight)</li>
              <li>• Не давай профиту уйти в минус</li>
            </ul>
          </InfoBox>
        </div>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Чеклист Model 1
        </h3>
        <ol className="mt-3 space-y-2">
          {RANGE_CHECKLIST.map((item, i) => (
            <li key={item.key} className="flex gap-3 text-sm text-zinc-400">
              <span className="font-mono text-zinc-600">{i + 1}.</span>
              <span>
                {item.label}
                {item.required && (
                  <span className="ml-2 text-[10px] text-zinc-600">обяз.</span>
                )}
                {item.hint && (
                  <span className="mt-0.5 block text-xs text-zinc-600">{item.hint}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Model 2 */}
      <section className="rounded-xl border border-emerald-800/40 bg-zinc-900/40 p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-medium text-emerald-300">
            Model 2
          </span>
          <h2 className="text-lg font-semibold text-white">Trend — Imbalanced Market</h2>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Одна сторона контролирует. Value смещается вверх (bull) или вниз (bear).
          Не фейди — присоединяйся к тренду на pullback. Сильные тренды часто fueled
          trapped traders (шортят uptrend → squeeze → continuation).
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <InfoBox title="Как формируется сетап">
            <ol className="space-y-1 text-sm text-zinc-400">
              <li>1. Агрессивный move в одну сторону</li>
              <li>2. Формируется LVN</li>
              <li>3. Pullback в LVN зону</li>
              <li>4. Opposite side агрессивна, но fails</li>
              <li>5. Тренд intact → вход</li>
            </ol>
          </InfoBox>
          <InfoBox title="Типы входа">
            <ul className="space-y-1 text-sm text-zinc-400">
              <li>• <strong className="text-zinc-200">Aggressive</strong> — в pullback зоне при absorption</li>
              <li>• <strong className="text-zinc-200">Confirmation</strong> — reclaim structure, HL (bull) / LH (bear)</li>
            </ul>
          </InfoBox>
          <InfoBox title="Управление">
            <ul className="space-y-1 text-sm text-zinc-400">
              <li>• Partial TP на структуре</li>
              <li>• Trail остаток по structure</li>
              <li>• BE после partial</li>
              <li>• Scale into strength, не weakness</li>
            </ul>
          </InfoBox>
          <InfoBox title="Ключевая идея">
            <p className="text-sm text-zinc-400">
              Identify imbalance → wait for pullback → confirm via order flow →
              execute with defined risk. Не chase breakout.
            </p>
          </InfoBox>
        </div>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Чеклист Model 2
        </h3>
        <ol className="mt-3 space-y-2">
          {TREND_CHECKLIST.map((item, i) => (
            <li key={item.key} className="flex gap-3 text-sm text-zinc-400">
              <span className="font-mono text-zinc-600">{i + 1}.</span>
              <span>
                {item.label}
                {item.required && (
                  <span className="ml-2 text-[10px] text-zinc-600">обяз.</span>
                )}
                {item.hint && (
                  <span className="mt-0.5 block text-xs text-zinc-600">{item.hint}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* AOI Framework */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">AOI Framework — 4 инструмента</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Каждая сделка начинается с Area of Interest. Минимум <strong className="text-zinc-200">2 подтверждения</strong> из
          списка. A+ сетап = 3–4 подтверждения.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AOI_LEVELS.map((level) => (
            <div
              key={level.key}
              className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400"
            >
              {level.label}
            </div>
          ))}
        </div>
      </section>

      {/* Rules */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">Правила исполнения</h2>
        <ul className="mt-4 space-y-2 text-sm text-zinc-400">
          <li className="flex gap-2">
            <Info size={14} className="mt-0.5 shrink-0 text-zinc-600" />
            Не антиципируй — реагируй на то, что видишь
          </li>
          <li className="flex gap-2">
            <Info size={14} className="mt-0.5 shrink-0 text-zinc-600" />
            Минимум 2 фактора для валидного AOI
          </li>
          <li className="flex gap-2">
            <Info size={14} className="mt-0.5 shrink-0 text-zinc-600" />
            Если цена не вернулась на уровень — нет сделки (patience)
          </li>
          <li className="flex gap-2">
            <Info size={14} className="mt-0.5 shrink-0 text-zinc-600" />
            Максимум 2–3 качественных сделки в день
          </li>
          <li className="flex gap-2">
            <Info size={14} className="mt-0.5 shrink-0 text-zinc-600" />
            Не торгуй прямо в сильный momentum — жди slowdown + reaction
          </li>
          <li className="flex gap-2">
            <Info size={14} className="mt-0.5 shrink-0 text-zinc-600" />
            Risk defined до входа. Winning trades не превращай в losers
          </li>
        </ul>
      </section>
    </div>
  );
}

function StaticConditionCard({ type }: { type: "balanced" | "imbalanced" }) {
  const data = MARKET_CONDITION_SIGNS[type];
  return (
    <div
      className={
        type === "balanced"
          ? "rounded-xl border border-blue-800/50 bg-blue-950/20 p-5"
          : "rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-5"
      }
    >
      <p
        className={
          type === "balanced" ? "font-semibold text-blue-300" : "font-semibold text-emerald-300"
        }
      >
        {data.title}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{data.subtitle}</p>
      <ul className="mt-4 space-y-2">
        {data.signs.map((sign) => (
          <li key={sign} className="text-sm text-zinc-400">
            • {sign}
          </li>
        ))}
      </ul>
      <p
        className={
          type === "balanced"
            ? "mt-4 rounded-lg bg-blue-950/50 px-3 py-2 text-sm text-blue-200"
            : "mt-4 rounded-lg bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200"
        }
      >
        → {data.action}
      </p>
    </div>
  );
}

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <h4 className="text-sm font-medium text-zinc-300">{title}</h4>
      <div className="mt-2">{children}</div>
    </div>
  );
}
