import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PanelComponent } from '../../../../../shared/ui';
import { WEEKLY_RHYTHM } from '../../roadmap.data';
import { TPipe } from '../../../../../core/i18n/t.pipe';

/** Suggested weekly sales & marketing pace. */
@Component({
  selector: 'app-weekly-rhythm',
  standalone: true,
  imports: [TPipe, PanelComponent],
  template: `
    <app-panel heading="Weekly rhythm" meta="Suggested pace">
      <dl class="rhythm">
        @for (item of rhythm; track item.label) {
          <div>
            <dt>{{ item.label | t }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        }
      </dl>
      <p class="muted small">{{ 'Direct outreach costs time, not money, so it comes first.' | t }}</p>
    </app-panel>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    app-panel { height: 100%; }
    .rhythm { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px; }
    /* Label comes first in the markup (dt before dd); the number is shown on top. */
    .rhythm div { display: flex; flex-direction: column-reverse; justify-content: flex-end; gap: 2px; }
    dd { margin: 0; font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
    dt { font-size: 12.5px; color: var(--muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeeklyRhythmComponent {
  protected readonly rhythm = WEEKLY_RHYTHM;
}
