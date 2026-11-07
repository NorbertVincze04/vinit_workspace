import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FINANCE } from '../../../../../core/data/finance.data';
import { percent, plural } from '../../../../../core/utils/format';
import { RonPipe } from '../../../../../shared/pipes/ron.pipe';
import {
  CardComponent,
  NumberStepperComponent,
  ProgressBarComponent,
  StatComponent,
  StatTone,
} from '../../../../../shared/ui';
import { MAX_SALONS, RoadmapStore } from '../../roadmap.store';

/** Paying-salon counter with income vs. costs and the break-even line (this year's goals). */
@Component({
  selector: 'app-salon-counter',
  standalone: true,
  imports: [CardComponent, NumberStepperComponent, ProgressBarComponent, StatComponent, RonPipe, RouterLink],
  templateUrl: './salon-counter.component.html',
  styleUrl: './salon-counter.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalonCounterComponent {
  readonly count = input.required<number>();
  readonly countChange = output<number>();
  /** Count comes from Subscriptions (no manual stepper). */
  readonly live = input(false);
  /** Real MRR in RON when known; otherwise count × Standard price. */
  readonly mrr = input<number | null>(null);

  private readonly plan = inject(RoadmapStore);
  protected readonly max = MAX_SALONS;
  protected readonly year = this.plan.currentYear;
  protected readonly costs = computed(() => Math.round((this.plan.goals().monthlyCostsBani ?? 0) / 100));
  protected readonly goal = computed(() => this.plan.goals().payingSalons ?? FINANCE.year1Salons);
  protected readonly breakEven = computed(() => this.plan.goals().breakEvenSalons ?? 0);
  protected readonly breakEvenPct = computed(() => percent(this.breakEven(), this.goal()));
  /** Year 1's checkpoints from the business plan (5 beta salons, 20 by month 9). */
  protected readonly marks = computed(() =>
    this.year() === 1
      ? [
          { label: `${FINANCE.betaSalons} beta`, pct: percent(FINANCE.betaSalons, this.goal()) },
          { label: `${FINANCE.month9Checkpoint}`, pct: percent(FINANCE.month9Checkpoint, this.goal()) },
        ]
      : [],
  );

  protected readonly progress = computed(() => percent(this.count(), this.goal()));
  protected readonly income = computed(() => this.mrr() ?? this.count() * FINANCE.standardPrice);
  protected readonly net = computed(() => this.income() - this.costs());
  protected readonly netTone = computed<StatTone>(() =>
    this.net() > 0 ? 'positive' : this.net() < 0 ? 'negative' : 'default',
  );

  protected readonly note = computed(() => {
    const n = this.count();
    const breakEven = this.breakEven();
    const goal = this.goal();
    const year = this.year();
    if (n < breakEven) {
      const left = breakEven - n;
      return `${left} more ${plural(left, 'salon', 'salons')} to cover your monthly costs.`;
    }
    if (n < goal) return `Costs are covered. ${goal - n} more to reach the Year ${year} goal of ${goal}.`;
    return `Year ${year} goal reached. Every extra salon is profit.`;
  });
}
