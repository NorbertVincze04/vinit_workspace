import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusPillComponent } from '../../../../../shared/ui';
import { BillingWarning } from '../../billing.model';
import { translateServer } from '../../../../../core/i18n/server-messages';
import { TPipe } from '../../../../../core/i18n/t.pipe';

const TONE = { bad: 'bad', warn: 'warn', info: 'info' } as const;
const LABEL: Record<string, string> = {
  trial_over: 'Trial over',
  trial_ending: 'Trial ending',
  payment_overdue: 'Overdue',
  past_due: 'Past due',
  min_term_ending: 'Term ending',
  no_subscription: 'No subscription',
  early_bird_low: 'Early Bird',
};

/** Billing problems, most urgent first; each links to its salon. */
@Component({
  selector: 'app-billing-warnings',
  standalone: true,
  imports: [TPipe, RouterLink, StatusPillComponent],
  template: `
    <ul>
      @for (w of warnings(); track $index) {
        <li>
          <app-status-pill [tone]="tone[w.severity]">{{ (label[w.kind] || w.kind) | t }}</app-status-pill>
          <span class="text">
            @if (w.salonId && showSalon()) {
              <a [routerLink]="['/tools/salons', w.salonId]">{{ w.salonName }}</a>:
            }
            {{ tr(w.message) }}
          </span>
        </li>
      }
    </ul>
  `,
  styles: `
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 14px; }
    .text { min-width: 0; overflow-wrap: anywhere; }
    a { font-weight: 600; color: var(--main); text-decoration: none; }
    a:hover { text-decoration: underline; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingWarningsComponent {
  readonly warnings = input.required<readonly BillingWarning[]>();
  readonly showSalon = input(true);
  protected readonly tone = TONE;
  protected readonly label = LABEL;
  /** Warnings are written by the server in English. */
  protected readonly tr = translateServer;
}
