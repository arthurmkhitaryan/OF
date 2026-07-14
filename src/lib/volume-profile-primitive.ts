import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { TickPrint, VolumeProfileResult } from "./market-types";

interface VpBar {
  y1: number;
  y2: number;
  widthFrac: number;
  kind: "poc" | "lvn" | "va" | "outer";
}

interface DeltaBar {
  y1: number;
  y2: number;
  widthFrac: number;
  /** +buy / -sell */
  delta: number;
}

interface RenderModel {
  vpBars: VpBar[];
  lvnYs: number[];
  deltaBars: DeltaBar[];
  xLeft: number;
  vpMaxW: number;
  xRight: number;
  deltaMaxW: number;
  showVp: boolean;
  showLvn: boolean;
  showDelta: boolean;
}

class OverlayRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly model: RenderModel | null) {}

  draw(target: CanvasRenderingTarget2D): void {
    const m = this.model;
    if (!m) return;

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      // —— Volume Profile (LEFT) ——
      if (m.showVp && m.vpBars.length) {
        ctx.fillStyle = "rgba(9,9,11,0.28)";
        ctx.fillRect(m.xLeft - 2, 0, m.vpMaxW + 8, mediaSize.height);

        for (const bar of m.vpBars) {
          const top = Math.min(bar.y1, bar.y2);
          const h = Math.max(1.5, Math.abs(bar.y2 - bar.y1) - 0.5);
          const w = Math.max(3, bar.widthFrac * m.vpMaxW);
          ctx.fillStyle =
            bar.kind === "poc"
              ? "rgba(167,139,250,0.92)"
              : bar.kind === "lvn"
                ? "rgba(251,146,60,0.9)"
                : bar.kind === "va"
                  ? "rgba(56,189,248,0.72)"
                  : "rgba(161,161,170,0.4)";
          // grow RIGHT from left edge
          ctx.fillRect(m.xLeft, top, w, h);
        }

        if (m.showLvn) {
          for (const y of m.lvnYs) {
            ctx.strokeStyle = "rgba(251,146,60,0.95)";
            ctx.lineWidth = 1.25;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.moveTo(m.xLeft, y);
            ctx.lineTo(m.xLeft + m.vpMaxW + 4, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "#fb923c";
            ctx.font = "bold 10px ui-monospace, monospace";
            ctx.textAlign = "left";
            ctx.fillText("LVN", m.xLeft + m.vpMaxW + 6, y + 3);
          }
        }

        ctx.fillStyle = "rgba(161,161,170,0.85)";
        ctx.font = "9px ui-sans-serif, system-ui";
        ctx.textAlign = "left";
        ctx.fillText("VP", m.xLeft + 2, 12);
      }

      // —— Delta by price (RIGHT) ——
      if (m.showDelta && m.deltaBars.length) {
        ctx.fillStyle = "rgba(9,9,11,0.28)";
        ctx.fillRect(m.xRight - m.deltaMaxW - 4, 0, m.deltaMaxW + 8, mediaSize.height);

        // zero axis
        ctx.strokeStyle = "rgba(113,113,122,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(m.xRight, 0);
        ctx.lineTo(m.xRight, mediaSize.height);
        ctx.stroke();

        for (const bar of m.deltaBars) {
          const top = Math.min(bar.y1, bar.y2);
          const h = Math.max(1.5, Math.abs(bar.y2 - bar.y1) - 0.5);
          const w = Math.max(2, bar.widthFrac * m.deltaMaxW);
          ctx.fillStyle =
            bar.delta >= 0 ? "rgba(52,211,153,0.75)" : "rgba(248,113,113,0.75)";
          // grow LEFT from right edge (toward candles)
          ctx.fillRect(m.xRight - w, top, w, h);
        }

        ctx.fillStyle = "rgba(161,161,170,0.85)";
        ctx.font = "9px ui-sans-serif, system-ui";
        ctx.textAlign = "right";
        ctx.fillText("Δ", m.xRight - 4, 12);
      }
    });
  }
}

class OverlayPaneView implements IPrimitivePaneView {
  private model: RenderModel | null = null;

  constructor(
    private readonly source: ChartSideOverlaysPrimitive,
    private readonly vpFrac: number,
    private readonly deltaFrac: number
  ) {}

  update(): void {
    const series = this.source.series;
    const chart = this.source.chart;
    const profile = this.source.profile;
    this.model = null;
    if (!series || !chart) return;

    const timeScale = chart.timeScale();
    const logical = timeScale.getVisibleLogicalRange();
    if (!logical) return;

    const xRightRaw = timeScale.logicalToCoordinate(logical.to);
    const xLeftRaw = timeScale.logicalToCoordinate(logical.from);
    if (xRightRaw == null || xLeftRaw == null) return;

    const paneWidth = Math.max(1, xRightRaw - xLeftRaw);
    const vpMaxW = Math.max(44, paneWidth * this.vpFrac);
    const deltaMaxW = Math.max(44, paneWidth * this.deltaFrac);
    const xLeft = xLeftRaw + 4;
    const xRight = xRightRaw - 4;

    const showVp = this.source.showVp && !!profile?.bins.length;
    const showLvn = this.source.showLvn;
    const showDelta = this.source.showDelta && this.source.prints.length > 0;

    let vpBars: VpBar[] = [];
    let lvnYs: number[] = [];
    if (showVp && profile) {
      const maxVol = Math.max(...profile.bins.map((b) => b.volume), 1);
      const binSize =
        profile.bins.length > 1
          ? Math.abs(profile.bins[1].price - profile.bins[0].price) || 1
          : 1;
      const lvnSet = new Set(profile.lvn.map((p) => Math.round(p * 100) / 100));

      for (const bin of profile.bins) {
        const y1 = series.priceToCoordinate(bin.price + binSize / 2);
        const y2 = series.priceToCoordinate(bin.price - binSize / 2);
        if (y1 == null || y2 == null) continue;
        const isPoc = Math.abs(bin.price - profile.poc) < binSize * 0.51;
        const isLvn = lvnSet.has(Math.round(bin.price * 100) / 100);
        const inVa = bin.price >= profile.val && bin.price <= profile.vah;
        vpBars.push({
          y1,
          y2,
          widthFrac: bin.volume / maxVol,
          kind: isPoc ? "poc" : isLvn ? "lvn" : inVa ? "va" : "outer",
        });
      }

      if (showLvn) {
        for (const price of profile.lvn.slice(0, 2)) {
          const y = series.priceToCoordinate(price);
          if (y != null) lvnYs.push(y);
        }
      }
    }

    let deltaBars: DeltaBar[] = [];
    if (showDelta) {
      const binSize = profile
        ? profile.bins.length > 1
          ? Math.abs(profile.bins[1].price - profile.bins[0].price) || 1
          : 2.5
        : 2.5;
      const map = new Map<number, number>();
      for (const p of this.source.prints) {
        const bin = Math.floor(p.price / binSize) * binSize;
        map.set(bin, (map.get(bin) ?? 0) + (p.side === "BUY" ? p.size : -p.size));
      }
      const entries = Array.from(map.entries());
      const maxAbs = Math.max(...entries.map(([, d]) => Math.abs(d)), 1);
      for (const [price, delta] of entries) {
        const y1 = series.priceToCoordinate(price + binSize / 2);
        const y2 = series.priceToCoordinate(price - binSize / 2);
        if (y1 == null || y2 == null) continue;
        deltaBars.push({
          y1,
          y2,
          widthFrac: Math.abs(delta) / maxAbs,
          delta,
        });
      }
    }

    this.model = {
      vpBars,
      lvnYs,
      deltaBars,
      xLeft,
      vpMaxW,
      xRight,
      deltaMaxW,
      showVp,
      showLvn,
      showDelta,
    };
  }

  renderer(): IPrimitivePaneRenderer | null {
    return new OverlayRenderer(this.model);
  }

  zOrder(): "top" | "bottom" | "normal" {
    return "top";
  }
}

/** VP on the LEFT + Delta-by-price on the RIGHT, inside the chart pane. */
export class ChartSideOverlaysPrimitive implements ISeriesPrimitive<Time> {
  profile: VolumeProfileResult | null = null;
  prints: TickPrint[] = [];
  showVp = true;
  showLvn = true;
  showDelta = true;
  series: ISeriesApi<"Candlestick"> | null = null;
  chart: IChartApi | null = null;
  private readonly view: OverlayPaneView;
  private requestUpdate: (() => void) | null = null;

  constructor(vpFrac = 0.28, deltaFrac = 0.28) {
    this.view = new OverlayPaneView(this, vpFrac, deltaFrac);
  }

  setData(opts: {
    profile: VolumeProfileResult | null;
    prints?: TickPrint[];
    showVp?: boolean;
    showLvn?: boolean;
    showDelta?: boolean;
  }) {
    this.profile = opts.profile;
    if (opts.prints) this.prints = opts.prints;
    if (opts.showVp != null) this.showVp = opts.showVp;
    if (opts.showLvn != null) this.showLvn = opts.showLvn;
    if (opts.showDelta != null) this.showDelta = opts.showDelta;
    this.view.update();
    this.requestUpdate?.();
  }

  attached(param: SeriesAttachedParameter<Time, "Candlestick">): void {
    this.chart = param.chart;
    this.series = param.series as ISeriesApi<"Candlestick">;
    this.requestUpdate = param.requestUpdate;
    this.view.update();
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  updateAllViews(): void {
    this.view.update();
  }

  paneViews() {
    return [this.view];
  }
}

/** @deprecated use ChartSideOverlaysPrimitive */
export { ChartSideOverlaysPrimitive as VolumeProfilePrimitive };
