import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { daysUntil, formatDate, formatDateTime } from '../../../../../core/utils/date';
import { Lead, lostLabel, sourceLabel } from '../../leads.model';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { t } from '../../../../../core/i18n/i18n';

/** Kanban card: who, where, next step. */
@Component({
  selector: 'app-lead-card',
  standalone: true,
  imports: [TPipe],
  template: `
    <span class="name">{{ lead().businessName }}</span>
    @if (sub()) {
      <span class="sub">{{ sub() }}</span>
    }
    <div class="meta">
      @if (lead().convertedSalonName) {
        <span class="tag salon">{{ 'Salon' | t }}: {{ lead().convertedSalonName }}</span>
      } @else if (lead().stage === 'lost') {
        <span class="tag">{{ lost() }}</span>
      } @else if (followUp()) {
        <span class="tag" [class.late]="followUp()!.late" [class.today]="followUp()!.today">{{ followUp()!.text }}</span>
      }
      @if (demo()) {
        <span class="tag">{{ 'Demo' | t }} {{ demo() }}</span>
      }
    </div>
  `,
  styles: `
    :host { display: grid; gap: 4px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--line);
      border-radius: var(--radius-md); box-shadow: var(--shadow-sm); cursor: pointer; font-size: 13.5px; min-width: 0; }
    :host(:hover) { border-color: var(--line-strong); }
    .name { font-weight: 600; font-size: 14px; overflow-wrap: anywhere; }
    .sub { color: var(--muted); font-size: 12.5px; overflow-wrap: anywhere; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px; }
    .meta:empty { display: none; }
    .tag { font-size: 11.5px; font-weight: 600; padding: 1px 7px; border-radius: var(--radius-pill);
      background: var(--tone-neutral-bg); color: var(--tone-neutral-fg); }
    .tag.today { background: var(--tone-warn-bg); color: var(--tone-warn-fg); }
    .tag.late { background: var(--tone-bad-bg); color: var(--tone-bad-fg); }
    .tag.salon { background: var(--tone-ok-bg); color: var(--tone-ok-fg); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadCardComponent {
  readonly lead = input.required<Lead>();

  protected readonly sub = computed(() => {
    const l = this.lead();
    return [l.city, l.contactName, sourceLabel(l.source)].filter(Boolean).join(' · ');
  });
  protected readonly lost = computed(() => t('Lost: {reason}', { reason: lostLabel(this.lead().lostReason) }));
  protected readonly demo = computed(() => {
    const l = this.lead();
    return l.demoAt && l.stage === 'demo_booked' ? formatDateTime(l.demoAt) : '';
  });
  protected readonly followUp = computed(() => {
    const d = this.lead().nextFollowUpOn;
    if (!d) return null;
    const days = daysUntil(d);
    const text = days < 0 ? t('Follow-up {n} d late', { n: -days }) : days === 0 ? t('Follow up today') : t('Follow up {date}', { date: formatDate(d, { day: 'numeric', month: 'short' }) });
    return { text, late: days < 0, today: days === 0 };
  });
}
