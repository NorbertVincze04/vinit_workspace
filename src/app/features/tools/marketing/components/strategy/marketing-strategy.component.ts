import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FINANCE } from '../../../../../core/data/finance.data';
import { PlanCalendarService } from '../../../../../core/services/plan-calendar.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { formatNumber } from '../../../../../core/utils/format';
import {
  BadgeComponent,
  ButtonComponent,
  ConfirmDialogComponent,
  Fact,
  FactsComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  IconComponent,
  MeterComponent,
  PanelComponent,
  asNumber,
  asString,
} from '../../../../../shared/ui';
import { Channel, MarketingStrategy, MonthPlan } from '../../marketing.model';
import { MarketingStore } from '../../marketing.store';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { countOf, t } from '../../../../../core/i18n/i18n';
import { tc } from '../../../../../core/i18n/content';
import { TcPipe } from '../../../../../core/i18n/tc.pipe';

type Section = 'objectives' | 'audience' | 'persona' | 'positioning' | 'budget' | 'channel' | 'month';

interface EditState {
  section: Section;
  heading: string;
  subheading: string;
  fields: FieldDef[];
  values: FormValues;
  /** Channel being edited (null = new channel). */
  channel?: string | null;
  /** Plan month being edited, 1–12. */
  month?: number;
}

const text = (key: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: 'text', maxLength: 300, span: 'full', ...extra });
const area = (key: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: 'textarea', maxLength: 2000, span: 'full', ...extra });
const lines = (v: string): string[] => v.split('\n').map((l) => l.trim()).filter(Boolean);
const list = (v: string): string[] => v.split(',').map((l) => l.trim()).filter(Boolean);

/**
 * The marketing strategy, section by section: objectives, budget, audience and persona, positioning
 * and offer, the channel mix (target vs. planned content) and the 12-month campaign plan.
 * Every section is edited in a dialog and saved as the "marketing.strategy" team setting.
 */
@Component({
  selector: 'app-marketing-strategy',
  standalone: true,
  imports: [TcPipe, TPipe, PanelComponent, FactsComponent, ButtonComponent, IconComponent, BadgeComponent, MeterComponent, FormDialogComponent, ConfirmDialogComponent],
  templateUrl: './marketing-strategy.component.html',
  styleUrl: './marketing-strategy.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingStrategyComponent {
  protected readonly store = inject(MarketingStore);
  private readonly plan = inject(PlanCalendarService);
  private readonly toast = inject(ToastService);

  /** Show a month's content in the calendar. */
  readonly openMonth = output<number>();

  protected readonly s = this.store.strategy;
  protected readonly editing = signal<EditState | null>(null);
  protected readonly removing = signal<Channel | null>(null);
  protected readonly resetting = signal(false);

  protected readonly format = formatNumber;
  protected readonly monthLabel = (n: number): string => this.plan.monthLabel(this.store.planMonth(n));
  /** Reset goes back to the business plan (Year 1) or to a copy of the year before. */
  protected readonly resetTarget = computed(() => (this.store.year().year === 1 ? t('the business plan') : t('Year {n}', { n: this.store.year().year - 1 })));
  protected readonly subline = (m: MonthPlan): string => [tc(m.element), tc(m.where)].filter(Boolean).join(' · ');

  protected readonly audienceFacts = computed<Fact[]>(() => {
    const a = this.s().audience;
    return [
      { label: 'Geographic', value: tc(a.geographic) },
      { label: 'Demographic', value: tc(a.demographic) },
      { label: 'Behaviour', value: tc(a.behavioral) },
      { label: 'Psychographic', value: tc(a.psychographic) },
    ];
  });

  protected readonly personaFacts = computed<Fact[]>(() => {
    const p = this.s().persona;
    return [
      { label: 'Name', value: p.name, hint: [p.age && t('{n} years', { n: p.age }), tc(p.role)].filter(Boolean).join(' · ') },
      { label: 'Lifestyle', value: tc(p.lifestyle) },
      { label: 'Main problem', value: tc(p.problem) },
    ];
  });

  protected readonly positioningFacts = computed<Fact[]>(() => {
    const p = this.s().positioning;
    return [
      { label: 'Value proposition', value: tc(p.valueProposition) },
      { label: 'Slogan', value: tc(p.slogan) },
      { label: 'Feature', value: tc(p.feature) },
      { label: 'Advantage', value: tc(p.advantage) },
      { label: 'Benefit', value: tc(p.benefit) },
      { label: 'Pricing strategy', value: tc(p.pricing) },
      { label: 'Distribution', value: tc(p.distribution) },
      { label: 'Competitors', value: tc(p.competitors) },
      { label: 'Launch offer', value: tc(p.launchOffer) },
    ];
  });

  protected readonly budget = computed(() => {
    const ads = this.store.adBudgetYear();
    const launch = this.s().launchBudget;
    return { launch, ads, total: launch + ads, spent: this.store.totals().adSpend, planMonthly: FINANCE.adsBudget };
  });

  protected readonly budgetFacts = computed<Fact[]>(() => {
    const b = this.budget();
    return [
      { label: 'Launch budget', value: `${formatNumber(b.launch)} RON`, hint: this.store.year().year === 1 ? 'One-off, from the initial investment' : 'One-off campaigns this year' },
      { label: t('Ads, year {n}', { n: this.store.year().year }), value: `${formatNumber(b.ads)} RON`, hint: 'Sum of the monthly budgets below' },
      { label: 'Total marketing', value: `${formatNumber(b.total)} RON` },
      { label: 'Ad spend planned', value: `${formatNumber(b.spent)} RON`, hint: 'On content items', warn: b.spent > b.ads },
    ];
  });

  /** Months with their planned content, for the 12-month table. */
  protected readonly monthRows = computed(() =>
    this.s().months.map((m, i) => ({ n: i + 1, plan: m, stats: this.store.monthStats()[i] })),
  );

  protected readonly mixRows = computed(() => {
    const shares = this.store.mix();
    return this.s().channels.map((c) => ({ channel: c, share: shares.find((x) => x.value === c.key) }));
  });

  // ---- editing ----

  protected edit(section: Exclude<Section, 'channel' | 'month'>): void {
    const s = this.s();
    switch (section) {
      case 'objectives':
        return this.open({
          section,
          heading: 'Objectives',
          subheading: 'What marketing has to achieve this year. One objective per line.',
          fields: [area('objectives', 'Objectives', { required: true, placeholder: 'Generate qualified leads and book demos' })],
          values: { objectives: s.objectives.map(tc).join('\n') },
        });
      case 'audience':
        return this.open({
          section,
          heading: 'Target audience',
          subheading: 'Who you sell to, by segment.',
          fields: [area('geographic', 'Geographic'), area('demographic', 'Demographic'), area('behavioral', 'Behaviour'), area('psychographic', 'Psychographic')],
          values: { geographic: tc(s.audience.geographic), demographic: tc(s.audience.demographic), behavioral: tc(s.audience.behavioral), psychographic: tc(s.audience.psychographic) },
        });
      case 'persona':
        return this.open({
          section,
          heading: 'Persona',
          subheading: 'The ideal client, as one person.',
          fields: [
            text('name', 'Name', { span: 1 }),
            text('age', 'Age', { span: 1, maxLength: 40 }),
            text('role', 'Role'),
            area('lifestyle', 'Lifestyle and personality'),
            area('problem', 'Main problem'),
          ],
          values: { ...s.persona, role: tc(s.persona.role), lifestyle: tc(s.persona.lifestyle), problem: tc(s.persona.problem) },
        });
      case 'positioning':
        return this.open({
          section,
          heading: 'Positioning & offer',
          subheading: 'What you promise, why it’s different and how you price and deliver it.',
          fields: [
            area('valueProposition', 'Value proposition'),
            text('slogan', 'Slogan'),
            area('feature', 'Feature (what it is)'),
            area('advantage', 'Advantage (what it does better)'),
            area('benefit', 'Benefit (what the client gains)'),
            area('pricing', 'Pricing strategy'),
            area('distribution', 'Distribution'),
            area('competitors', 'Competitors'),
            area('launchOffer', 'Launch offer'),
          ],
          values: Object.fromEntries(Object.entries(s.positioning).map(([k, v]) => [k, tc(v)])),
        });
      case 'budget':
        return this.open({
          section,
          heading: 'Launch budget',
          subheading: 'The one-off marketing budget for the launch. Monthly ad budgets are set per month in the 12-month plan.',
          fields: [{ key: 'launchBudget', label: 'Launch budget (RON)', type: 'number', integer: true, min: 0, span: 'full', placeholder: '2000' }],
          values: { launchBudget: s.launchBudget },
        });
    }
  }

  protected editChannel(c: Channel | null): void {
    const left = 100 - this.store.mixTargetTotal() + (c?.target ?? 0);
    this.open({
      section: 'channel',
      heading: c ? t('Edit {name}', { name: tc(c.label) }) : t('New channel'),
      subheading: 'A channel of the communication mix and its target share of appearances.',
      fields: [
        text('label', 'Channel', { required: true, maxLength: 80, placeholder: 'e.g. Referrals', span: 1 }),
        { key: 'target', label: 'Target share (%)', type: 'number', integer: true, required: true, min: 0, max: 100, hint: t('{pct}% left to reach 100%', { pct: Math.max(0, left) }), span: 1 },
        area('tactics', 'How you use it', { placeholder: 'Who you reach, with what, how often' }),
      ],
      values: c ? { label: tc(c.label), target: c.target, tactics: tc(c.tactics) } : { target: Math.max(0, left) },
      channel: c?.key ?? null,
    });
  }

  protected editMonth(n: number): void {
    const m = this.s().months[n - 1];
    this.open({
      section: 'month',
      heading: `${t('Month {n}', { n })} · ${this.monthLabel(n)}`,
      subheading: 'The month’s campaign: theme, channel, keywords, how much content and the ad budget.',
      fields: [
        text('theme', 'Theme', { required: true }),
        text('element', 'Element of the mix', { placeholder: 'e.g. Product ad / Sales force' }),
        text('where', 'Platforms', { placeholder: 'e.g. Instagram, Facebook Ads' }),
        area('goal', 'Goal of the month', { placeholder: 'What this month should achieve' }),
        text('keywords', 'Keywords', { hint: 'Separated by commas. Suggested on new content of this month.' }),
        { key: 'target', label: 'Planned appearances', type: 'number', integer: true, min: 0, max: 1000, span: 1, placeholder: '8' },
        { key: 'budget', label: 'Ad budget (RON)', type: 'number', integer: true, min: 0, span: 1, placeholder: '500' },
      ],
      values: { theme: tc(m.theme), element: tc(m.element), where: tc(m.where), goal: tc(m.goal), keywords: m.keywords.map(tc).join(', '), target: m.target, budget: m.budget },
      month: n,
    });
  }

  private open(state: EditState): void {
    this.editing.set(state);
  }

  protected save(v: FormValues): void {
    const e = this.editing();
    if (!e) return;
    const s: MarketingStrategy = this.s();
    switch (e.section) {
      case 'objectives':
        this.store.updateStrategy({ objectives: lines(asString(v['objectives'])).slice(0, 20) });
        break;
      case 'audience':
        this.store.updateStrategy({
          audience: { geographic: asString(v['geographic']), demographic: asString(v['demographic']), behavioral: asString(v['behavioral']), psychographic: asString(v['psychographic']) },
        });
        break;
      case 'persona':
        this.store.updateStrategy({
          persona: { name: asString(v['name']), age: asString(v['age']), role: asString(v['role']), lifestyle: asString(v['lifestyle']), problem: asString(v['problem']) },
        });
        break;
      case 'positioning': {
        const p = { ...s.positioning };
        for (const key of Object.keys(p) as (keyof typeof p)[]) p[key] = asString(v[key]);
        this.store.updateStrategy({ positioning: p });
        break;
      }
      case 'budget':
        this.store.updateStrategy({ launchBudget: Math.max(0, asNumber(v['launchBudget'])) });
        break;
      case 'channel':
        this.store.saveChannel(e.channel ?? null, {
          label: asString(v['label']),
          target: Math.min(100, Math.max(0, asNumber(v['target']))),
          tactics: asString(v['tactics']),
        });
        break;
      case 'month':
        this.store.updateMonth(e.month ?? 1, {
          theme: asString(v['theme']),
          element: asString(v['element']),
          where: asString(v['where']),
          goal: asString(v['goal']),
          keywords: list(asString(v['keywords'])).slice(0, 20),
          target: Math.max(0, asNumber(v['target'])),
          budget: Math.max(0, asNumber(v['budget'])),
        });
        break;
    }
    this.toast.show('Strategy saved');
  }

  protected removeMessage(c: Channel): string {
    const n = this.store.postsOnChannel(c.key);
    const removed = t('“{name}” will be removed from the mix.', { name: tc(c.label) });
    return n ? `${removed} ${t('{items} on it will keep the channel’s key but no longer count in the mix.', { items: countOf(n, 'content item', 'content items') })}` : removed;
  }

  protected confirmRemove(c: Channel): void {
    this.store.removeChannel(c.key);
    this.toast.show(t('Removed {name}', { name: tc(c.label) }));
  }

  protected confirmReset(): void {
    this.store.resetStrategy();
    this.toast.show(t('Strategy reset to {target}', { target: this.resetTarget() }));
  }
}
