import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BREAK_EVEN_SALONS, FINANCE } from '../../../../../core/data/finance.data';
import { percent, plural } from '../../../../../core/utils/format';
import { RonPipe } from '../../../../../shared/pipes/ron.pipe';
import {
  CardComponent,
  NumberStepperComponent,
  ProgressBarComponent,
  StatComponent,
  StatTone,
} from '../../../../../shared/ui';
import { MAX_SALONS } from '../../roadmap.store';

/** Paying-salon counter with income vs. costs and the break-even line. */
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

  protected readonly max = MAX_SALONS;
  protected readonly costs = FINANCE.monthlyCosts;
  protected readonly goal = FINANCE.year1Salons;
  protected readonly breakEven = BREAK_EVEN_SALONS;
  protected readonly breakEvenPct = percent(BREAK_EVEN_SALONS, FINANCE.year1Salons);
  protected readonly marks = [
    { label: `${FINANCE.betaSalons} beta`, pct: percent(FINANCE.betaSalons, FINANCE.year1Salons) },
    { label: `${FINANCE.month9Checkpoint}`, pct: percent(FINANCE.month9Checkpoint, FINANCE.year1Salons) },
  ];

  protected readonly progress = computed(() => percent(this.count(), this.goal));
  protected readonly income = computed(() => this.mrr() ?? this.count() * FINANCE.standardPrice);
  protected readonly net = computed(() => this.income() - this.costs);
  protected readonly netTone = computed<StatTone>(() =>
    this.net() > 0 ? 'positive' : this.net() < 0 ? 'negative' : 'default',
  );

  protected readonly note = computed(() => {
    const n = this.count();
    if (n < this.breakEven) {
      const left = this.breakEven - n;
      return `${left} more ${plural(left, 'salon', 'salons')} to cover your monthly costs.`;
    }
    if (n < this.goal) return `Costs are covered. ${this.goal - n} more to reach the Year 1 goal of ${this.goal}.`;
    return 'Year 1 goal reached. Every extra salon is profit.';
  });
}
