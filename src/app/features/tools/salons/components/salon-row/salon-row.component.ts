import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LedgerRowComponent, StatusPillComponent } from '../../../../../shared/ui';
import { Salon, salonStatus } from '../../salons.model';

/** One salon in the list. The whole row opens the salon's page. */
@Component({
  selector: 'app-salon-row',
  standalone: true,
  imports: [LedgerRowComponent, StatusPillComponent, RouterLink],
  template: `
    <app-ledger-row clickable (activate)="open.emit()">
      <div>
        <a class="cell-title name" [routerLink]="['/tools/salons', salon().id]">{{ salon().name }}</a>
        <span class="cell-sub">{{ sub() }}</span>
      </div>
      <div>
        <span>{{ salon().clientName }}</span>
        @if (salon().clientAddressMissing) {
          <span class="cell-sub warn">Business address missing</span>
        } @else if (salon().clientPhone) {
          <span class="cell-sub">{{ salon().clientPhone }}</span>
        }
      </div>
      <div>
        <span>{{ salon().planName || 'No plan' }}</span>
      </div>
      <div><app-status-pill [tone]="status().tone">{{ status().label }}</app-status-pill></div>
    </app-ledger-row>
  `,
  styles: `
    :host { display: block; }
    .name { color: inherit; text-decoration: none; }
    .name:hover { color: var(--main); text-decoration: underline; }
    .warn { color: var(--red); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalonRowComponent {
  readonly salon = input.required<Salon>();
  readonly open = output<void>();

  protected readonly status = computed(() => salonStatus(this.salon().status));
  protected readonly sub = computed(() => [this.salon().city, this.salon().primaryDomain].filter(Boolean).join(' · '));
}
