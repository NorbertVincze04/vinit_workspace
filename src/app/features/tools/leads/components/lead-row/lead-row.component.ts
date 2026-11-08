import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { daysUntil, formatDate } from '../../../../../core/utils/date';
import { LedgerRowComponent, StatusPillComponent } from '../../../../../shared/ui';
import { Lead, sourceLabel, stageInfo } from '../../leads.model';
import { TPipe } from '../../../../../core/i18n/t.pipe';

/** One lead in the list view. */
@Component({
  selector: 'app-lead-row',
  standalone: true,
  imports: [TPipe, LedgerRowComponent, StatusPillComponent],
  template: `
    <app-ledger-row clickable (activate)="open.emit()">
      <div>
        <span class="cell-title">{{ lead().businessName }}</span>
        <span class="cell-sub">{{ sub() }}</span>
      </div>
      <div class="contact">
        @if (lead().phone) {
          <span>{{ lead().phone }}</span>
        }
        @if (lead().instagram) {
          <span>{{ lead().instagram }}</span>
        }
        @if (lead().email) {
          <span>{{ lead().email }}</span>
        }
      </div>
      <div><app-status-pill [tone]="stage().tone">{{ stage().label | t }}</app-status-pill></div>
      <div>
        @if (followUp(); as f) {
          <span [class.late]="f.late">{{ f.text }}</span>
        } @else {
          <span class="cell-sub">—</span>
        }
      </div>
    </app-ledger-row>
  `,
  styles: `
    :host { display: block; }
    .contact { display: grid; font-size: 13.5px; overflow-wrap: anywhere; }
    .late { color: var(--red); font-weight: 600; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadRowComponent {
  readonly lead = input.required<Lead>();
  readonly open = output<void>();

  protected readonly stage = computed(() => stageInfo(this.lead().stage));
  protected readonly sub = computed(() => {
    const l = this.lead();
    return [l.city, l.contactName, sourceLabel(l.source)].filter(Boolean).join(' · ');
  });
  protected readonly followUp = computed(() => {
    const d = this.lead().nextFollowUpOn;
    return d ? { text: formatDate(d), late: daysUntil(d) < 0 } : null;
  });
}
