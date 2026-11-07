import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDate } from '../../../../../core/utils/date';
import { RonPipe } from '../../../../../shared/pipes/ron.pipe';
import { LedgerRowComponent, MenuComponent, MenuItemComponent, StatusPillComponent } from '../../../../../shared/ui';
import { CHANGES_FOR, CHANGE_ACTIONS, ChangeKind, Subscription, cycleInfo, subStatus } from '../../billing.model';

/** One subscription: salon, plan, price, status, key date, and the changes it allows. */
@Component({
  selector: 'app-subscription-row',
  standalone: true,
  imports: [LedgerRowComponent, StatusPillComponent, MenuComponent, MenuItemComponent, RonPipe, RouterLink],
  template: `
    <app-ledger-row>
      <div>
        <a class="cell-title link" [routerLink]="['/tools/salons', sub().salonId]">{{ sub().salonName }}</a>
        <span class="cell-sub">{{ planLine() }}</span>
      </div>
      <div class="cell-num">
        <span>{{ sub().price | ron }}</span>
        <span class="cell-sub">{{ cycle().per }}</span>
      </div>
      <div><app-status-pill [tone]="status().tone">{{ status().label }}</app-status-pill></div>
      <div>
        <span>{{ dateLine() }}</span>
      </div>
      <div class="cell-actions">
        @if (actions().length) {
          <app-menu [ariaLabel]="'Change subscription of ' + sub().salonName">
            @for (a of actions(); track a) {
              <button appMenuItem type="button" [tone]="a === 'cancel' ? 'danger' : 'default'" (click)="change.emit(a)">{{ label(a) }}…</button>
            }
          </app-menu>
        }
      </div>
    </app-ledger-row>
  `,
  styles: `
    :host { display: block; }
    .link { color: inherit; text-decoration: none; }
    .link:hover { color: var(--main); text-decoration: underline; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionRowComponent {
  readonly sub = input.required<Subscription>();
  readonly change = output<ChangeKind>();

  protected readonly status = computed(() => subStatus(this.sub().status));
  protected readonly cycle = computed(() => cycleInfo(this.sub().billingCycle));
  protected readonly actions = computed(() => CHANGES_FOR[this.sub().status]);
  protected readonly label = (a: ChangeKind) => CHANGE_ACTIONS[a];
  protected readonly planLine = computed(() => [this.sub().planName, this.sub().promotionName].filter(Boolean).join(' · '));
  protected readonly dateLine = computed(() => {
    const s = this.sub();
    if (s.status === 'trialing') return s.trialEndsOn ? `Free until ${formatDate(s.trialEndsOn)}` : 'Free (no end date)';
    if (s.status === 'canceled' || s.status === 'ended') return `Ended ${formatDate(s.canceledOn)}`;
    return `Since ${formatDate(s.startedOn)}`;
  });
}
