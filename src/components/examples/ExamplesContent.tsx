import Link from "next/link";
import { IMAGE_SECTIONS, TRADEZELLA_IMAGES, type TradezellaImage } from "@/lib/tradezella-images";

export function ExamplesContent() {
  return (
    <div className="space-y-12">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <p className="text-sm leading-relaxed text-zinc-400">
          Все графики взяты из официального playbook{" "}
          <Link
            href="https://www.tradezella.com/strategies/order-flow-strategy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            TradeZella — Order Flow Strategy (Yush)
          </Link>
          . Это те же изображения, что на сайте: реальные footprint/volume profile
          графики и ручные схемы моделей.
        </p>
      </section>

      {IMAGE_SECTIONS.map((section) => {
        const images = TRADEZELLA_IMAGES.filter((img) => img.section === section.id);
        if (images.length === 0) return null;

        return (
          <section key={section.id} className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-white">{section.title}</h2>
              <p className="mt-1 text-sm text-zinc-500">{section.subtitle}</p>
            </div>

            <div className="space-y-8">
              {images.map((img) => (
                <TradezellaImageCard key={img.id} image={img} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">Как читать эти графики</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <LegendItem color="bg-amber-500" title="Big Trades" text="Цветные круги на свечах — крупные сделки (75+ NQ, 200+ ES)" />
          <LegendItem color="bg-emerald-500" title="Delta" text="Гистограмма справа: синий = buyers, красный = sellers" />
          <LegendItem color="bg-red-500" title="Absorption" text="Большой delta + цена НЕ идёт в эту сторону" />
          <LegendItem color="bg-purple-500" title="LVN" text="Провал в volume profile — цена прошла быстро" />
          <LegendItem color="bg-blue-500" title="VAH / VAL" text="Края Value Area — зоны для Model 1 Range" />
          <LegendItem color="bg-zinc-500" title="Зоны (прямоугольники)" text="Balance areas — range boundaries" />
        </div>
      </section>
    </div>
  );
}

function TradezellaImageCard({ image }: { image: TradezellaImage }) {
  return (
    <article className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-5 py-4">
        <h3 className="font-semibold text-white">{image.titleRu}</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{image.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {image.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-0.5 text-xs text-zinc-400"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="relative bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.title}
          className="mx-auto w-full max-w-5xl object-contain"
        />
      </div>
    </article>
  );
}

function LegendItem({
  color,
  title,
  text,
}: {
  color: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${color}`} />
      <div>
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{text}</p>
      </div>
    </div>
  );
}
