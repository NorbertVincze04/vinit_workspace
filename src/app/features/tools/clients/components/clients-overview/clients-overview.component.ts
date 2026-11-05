import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FINANCE } from '../../../../../core/data/finance.data';
import { formatRon } from '../../../../../core/utils/format';
import { RonPipe } from '../../../../../shared/pipes/ron.pipe';
import { CardComponent, MeterComponent, StatComponent } from '../../../../../shared/ui';

/** Totals band: clients, active clients, MRR and progress towards monthly break-even. */
@Component({
  selector: 'app-clients-overview',
  standalone: true,
  imports: [CardComponent, StatComponent, MeterComponent, RonPipe],
  template: `
    <app-card>
      <div class="band">
        <app-stat label="Clients" [value]="'' + total()" />
        <app-stat label="Active" [value]="'' + active()" />
        <app-stat label="MRR" [value]="mrr() | ron" />
        <div class="be">
          <div class="be-top">
            <span class="eyebrow">Monthly break-even</span>
            <span>{{ mrr() | ron }} of {{ costs | ron }}</span>
          </div>
          <app-meter [value]="breakEvenPercent()" [label]="'MRR ' + format(mrr()) + ' of ' + format(costs) + ' monthly costs'" />
        </div>
      </div>
    </app-card>
  `,
  styles: `
    :host { display: block; margin-bottom: 18px; }
    .band { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px 40px; }
    .be { flex: 1 1 260px; display: grid; gap: 9px; min-width: 0; }
    .be-top { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 13.5px;
      font-variant-numeric: tabular-nums; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsOverviewComponent {
  readonly total = input.required<number>();
  readonly active = input.required<number>();
  readonly mrr = input.required<number>();
  readonly breakEvenPercent = input.required<number>();

  protected readonly costs = FINANCE.monthlyCosts;
  protected readonly format = formatRon;
}
