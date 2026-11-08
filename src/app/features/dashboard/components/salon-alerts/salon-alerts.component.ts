import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { daysUntil, formatDate } from '../../../../core/utils/date';
import { PanelComponent, StatusPillComponent, StatusTone } from '../../../../shared/ui';
import { LeadsStore } from '../../../tools/leads/leads.store';
import { ONBOARDING_HOURS, clockOf } from '../../../tools/onboarding/onboarding.model';
import { OnboardingStore } from '../../../tools/onboarding/onboarding.store';
import { BillingStore } from '../../../tools/subscriptions/billing.store';
import { SupportStore } from '../../../tools/support/support.store';
import { CalendarStore } from '../../../tools/calendar/calendar.store';
import { InfraStore } from '../../../tools/infra/infra.store';
import { categoryLabel, whenInfo } from '../../../tools/calendar/calendar.model';
import { ticketNo } from '../../../tools/support/support.model';
import { translateServer } from '../../../../core/i18n/server-messages';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { countOf, t } from '../../../../core/i18n/i18n';

interface Alert {
  key: string;
  tag: string;
  tone: StatusTone;
  title: string;
  text: string;
  route: string;
  query?: Record<string, string>;
  /** Lower first. */
  rank: number;
}

const WARNING_TAGS: Record<string, string> = {
  trial_over: 'Trial over',
  trial_ending: 'Trial ending',
  payment_overdue: 'Overdue',
  past_due: 'Past due',
  min_term_ending: 'Term ending',
  no_subscription: 'No subscription',
  early_bird_low: 'Early Bird',
};
const SHOWN = 8;

/**
 * Overview: what needs doing on the salon side today. Overdue payments, trials ending,
 * onboardings past 48h, urgent tickets and lead follow-ups that are due.
 */
@Component({
  selector: 'app-salon-alerts',
  standalone: true,
  imports: [TPipe, RouterLink, PanelComponent, StatusPillComponent],
  template: `
    <app-panel heading="Needs attention" [meta]="alerts().length ? alerts().length + '' : ''" [flush]="true">
      @if (alerts().length) {
        <ul>
          @for (a of shown(); track a.key) {
            <li>
              <app-status-pill [tone]="a.tone">{{ a.tag }}</app-status-pill>
              <a class="main" [routerLink]="a.route" [queryParams]="a.query ?? null">
                <span class="name">{{ a.title }}</span>
                <span class="sub">{{ a.text }}</span>
              </a>
            </li>
          }
        </ul>
        @if (alerts().length > shownCount()) {
          <button class="more" type="button" (click)="all.set(true)">{{ 'Show {n} more' | t: { n: alerts().length - shownCount() } }}</button>
        }
      } @else {
        <p class="empty">{{ 'Nothing urgent: no late payments, trials ending, late onboardings, urgent tickets, follow-ups or deadlines due.' | t }}</p>
      }
    </app-panel>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    app-panel { height: 100%; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { display: grid; grid-template-columns: 130px minmax(0, 1fr); align-items: center; gap: 10px; padding: 10px 18px;
      border-top: 1px solid var(--line); }
    li:first-child { border-top: 0; }
    li app-status-pill { justify-self: start; }
    .main { display: grid; min-width: 0; color: inherit; text-decoration: none; }
    .main:hover .name { color: var(--main); text-decoration: underline; }
    .name { font-weight: 500; overflow-wrap: anywhere; }
    .sub { font-size: 12.5px; color: var(--muted); overflow-wrap: anywhere; }
    .empty { padding: 24px 18px; color: var(--muted); }
    .more { display: block; width: 100%; padding: 10px; font: inherit; font-size: 13px; color: var(--main); background: none;
      border: 0; border-top: 1px solid var(--line); cursor: pointer; }
    @media (max-width: 420px) { li { grid-template-columns: minmax(0, 1fr); gap: 4px; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalonAlertsComponent {
  private readonly billing = inject(BillingStore);
  private readonly onboarding = inject(OnboardingStore);
  private readonly support = inject(SupportStore);
  private readonly leads = inject(LeadsStore);
  private readonly calendar = inject(CalendarStore);
  private readonly infra = inject(InfraStore);

  constructor() {
    void this.infra.reload();
  }

  protected readonly all = signal(false);

  protected readonly alerts = computed<Alert[]>(() => {
    const out: Alert[] = [];

    for (const [i, w] of this.billing.warnings().entries()) {
      if (w.kind === 'min_term_ending') continue;
      out.push({
        key: `w${i}`,
        tag: t(WARNING_TAGS[w.kind] ?? w.kind),
        tone: w.severity === 'bad' ? 'bad' : w.severity === 'warn' ? 'warn' : 'info',
        title: w.salonName ?? t('Subscriptions'),
        text: translateServer(w.message),
        route: w.salonId ? `/tools/salons/${w.salonId}` : '/tools/subscriptions',
        query: w.salonId ? { tab: 'billing' } : undefined,
        rank: w.severity === 'bad' ? 0 : 2,
      });
    }

    for (const o of this.onboarding.open()) {
      if (!o.late && o.status !== 'blocked') continue;
      out.push({
        key: `o${o.id}`,
        tag: o.late ? t('Over {h}h', { h: ONBOARDING_HOURS }) : t('Blocked'),
        tone: 'bad',
        title: o.salonName,
        text: o.status === 'blocked' ? t('Onboarding blocked: {reason}', { reason: o.blockedReason }) : t('Onboarding: {clock}', { clock: clockOf(o).text }),
        route: `/tools/salons/${o.salonId}`,
        query: { tab: 'onboarding' },
        rank: 1,
      });
    }

    for (const tk of this.support.urgent()) {
      out.push({
        key: `t${tk.id}`,
        tag: t(tk.priority === 'urgent' ? 'Urgent' : 'High'),
        tone: tk.priority === 'urgent' ? 'bad' : 'warn',
        title: tk.salonName,
        text: `${ticketNo(tk.number)} ${tk.title}`,
        route: `/tools/salons/${tk.salonId}`,
        query: { tab: 'support' },
        rank: tk.priority === 'urgent' ? 1 : 3,
      });
    }

    for (const l of this.leads.dueToday()) {
      const days = daysUntil(l.nextFollowUpOn);
      out.push({
        key: `l${l.id}`,
        tag: t(days < 0 ? 'Follow-up late' : 'Follow up'),
        tone: days < 0 ? 'warn' : 'info',
        title: l.businessName,
        text: days < 0 ? t('Follow-up was due {date}', { date: formatDate(l.nextFollowUpOn) }) : t('Follow-up due today'),
        route: '/tools/leads',
        rank: days < 0 ? 3 : 4,
      });
    }

    // Deadlines inside their reminder window (the earliest reminder has passed) or late.
    for (const d of this.calendar.upcoming()) {
      // Trials are already in the billing warnings above.
      if (d.sourceType === 'trial' || d.daysLeft > Math.ceil(Math.max(0, ...d.reminders) / 1440)) continue;
      const w = whenInfo(d);
      out.push({
        key: `d${d.id}`,
        tag: w.text,
        tone: w.tone,
        title: d.title,
        text: [categoryLabel(d.category), d.salonName].filter(Boolean).join(' · '),
        route: '/tools/calendar',
        rank: d.daysLeft < 0 ? 0 : d.daysLeft <= 3 ? 2 : 4,
      });
    }

    // Infrastructure: SMS budget, backups that are old or never made.
    const h = this.infra.health();
    if (h) {
      if (h.sms.pct >= 80) {
        out.push({ key: 'sms', tag: `SMS ${h.sms.pct}%`, tone: h.sms.pct >= 100 ? 'bad' : 'warn', title: t('SMS budget'), text: t('{sent} of {budget} SMS used this month', { sent: h.sms.sent, budget: h.sms.budget }), route: '/tools/infra', rank: 2 });
      }
      const b = h.backups;
      if (b.lastBackupDays === null || b.lastBackupDays > 7) {
        out.push({ key: 'backup', tag: t('Backup'), tone: b.lastBackupDays === null || b.lastBackupDays > 30 ? 'bad' : 'warn', title: t('Back up the database'), text: b.lastBackupDays === null ? t('No backup recorded yet: npm run db:backup') : t('Last backup {days} ago', { days: countOf(b.lastBackupDays, 'day', 'days') }), route: '/tools/infra', rank: 3 });
      }
      if (b.lastRestoreTestDays === null || b.lastRestoreTestDays > 90) {
        out.push({ key: 'restore', tag: t('Restore test'), tone: 'warn', title: t('Test a restore'), text: b.lastRestoreTestDays === null ? t('A backup only counts once a restore worked') : t('Last restore test {days} ago', { days: countOf(b.lastRestoreTestDays, 'day', 'days') }), route: '/tools/infra', rank: 5 });
      }
    }

    return out.sort((a, b) => a.rank - b.rank);
  });

  protected readonly shownCount = computed(() => (this.all() ? this.alerts().length : SHOWN));
  protected readonly shown = computed(() => this.alerts().slice(0, this.shownCount()));
}
