import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { formatNumber, formatRon } from '../../../core/utils/format';

export interface ChartSeries {
  key: string;
  label: string;
  /** CSS colour, normally a token: 'var(--chart-1)'. */
  color: string;
}

export interface ChartGroup {
  key: string;
  label: string;
  /** Full label for the tooltip and the table view. */
  title: string;
  values: Record<string, number>;
  selected?: boolean;
  /** Extra tooltip lines, e.g. { label: 'Left over', value: '1.200 RON' }. */
  extra?: readonly { label: string; value: string }[];
}

interface BarGeometry {
  key: string;
  path: string;
  color: string;
}

/**
 * Grouped vertical bar chart (one group per period, one bar per series) with legend, hover tooltip,
 * click-to-select and a screen-reader table. Single y-axis starting at 0.
 *   <app-bar-chart [series]="series" [groups]="groups()" (groupSelect)="month.set($event)" />
 */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  templateUrl: './bar-chart.component.html',
  styleUrl: './bar-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarChartComponent {
  readonly series = input.required<readonly ChartSeries[]>();
  readonly groups = input.required<readonly ChartGroup[]>();
  readonly ariaLabel = input('Bar chart');
  readonly formatValue = input<(value: number) => string>((v) => formatRon(v));

  readonly groupSelect = output<string>();

  // Geometry (SVG user units)
  protected readonly W = 600;
  protected readonly H = 230;
  private readonly L = 56;
  private readonly R = 8;
  protected readonly T = 10;
  private readonly B = 28;

  protected readonly hovered = signal<number | null>(null);

  protected readonly plotW = this.W - this.L - this.R;
  protected readonly plotH = this.H - this.T - this.B;
  protected readonly baseline = this.T + this.plotH;

  protected readonly max = computed(() => {
    let top = 0;
    for (const g of this.groups()) for (const s of this.series()) top = Math.max(top, g.values[s.key] ?? 0);
    return niceMax(top);
  });

  protected readonly ticks = computed(() =>
    [0, 1, 2, 3, 4].map((i) => ({
      y: this.T + this.plotH - (this.plotH * i) / 4,
      label: i === 0 ? '0' : compact((this.max() * i) / 4),
    })),
  );

  protected readonly groupWidth = computed(() => this.plotW / Math.max(1, this.groups().length));

  protected readonly layout = computed(() => {
    const gw = this.groupWidth();
    const n = this.series().length;
    const bw = Math.max(4, Math.min(18, (gw - 22) / n));
    const gap = 2;
    return this.groups().map((g, gi) => {
      const gx = this.L + gw * gi;
      const start = gx + (gw - (bw * n + gap * (n - 1))) / 2;
      const bars: BarGeometry[] = this.series().map((s, si) => {
        const v = g.values[s.key] ?? 0;
        let h = (this.plotH * v) / this.max();
        if (v > 0 && h < 2) h = 2;
        return { key: s.key, color: s.color, path: barPath(start + si * (bw + gap), this.baseline - h, bw, h, 4) };
      });
      return { group: g, x: gx, center: gx + gw / 2, bars };
    });
  });

  /** Tooltip horizontal position in % of the chart width. */
  protected readonly tipLeft = computed(() => {
    const i = this.hovered();
    if (i === null) return 0;
    return ((this.layout()[i]?.center ?? 0) / this.W) * 100;
  });

  protected readonly tipAlign = computed(() => {
    const left = this.tipLeft();
    return left < 18 ? 'start' : left > 82 ? 'end' : 'center';
  });

  protected valueOf(group: ChartGroup, key: string): string {
    return this.formatValue()(group.values[key] ?? 0);
  }
}

function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

function compact(n: number): string {
  if (n >= 1e6) return `${Math.round(n / 1e5) / 10}M`.replace('.', ',');
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`.replace('.', ',');
  return formatNumber(n);
}

/** Bar with rounded top corners, anchored to the baseline. */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}
