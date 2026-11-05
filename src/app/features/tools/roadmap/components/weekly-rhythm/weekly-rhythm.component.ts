import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardComponent } from '../../../../../shared/ui';
import { WEEKLY_RHYTHM } from '../../roadmap.data';

/** Suggested weekly sales & marketing pace. */
@Component({
  selector: 'app-weekly-rhythm',
  standalone: true,
  imports: [CardComponent],
  template: `
    <app-card padding="lg">
      <h2 class="title-md">Weekly rhythm</h2>
      <dl class="rhythm">
        @for (item of rhythm; track item.label) {
          <div>
            <dt class="eyebrow">{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        }
      </dl>
      <p class="muted small">Suggested pace. Direct outreach costs time, not money, so it comes first.</p>
    </app-card>
  `,
  styles: `
    :host { display: block; min-width: 0; height: 100%; }
    app-card { height: 100%; }
    .rhythm { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .rhythm div { display: flex; flex-direction: column-reverse; justify-content: flex-end; }
    dd { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 44px; line-height: 1; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeeklyRhythmComponent {
  protected readonly rhythm = WEEKLY_RHYTHM;
}
