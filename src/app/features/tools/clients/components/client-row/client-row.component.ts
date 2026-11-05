import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { formatDate } from '../../../../../core/utils/date';
import { RonPipe } from '../../../../../shared/pipes/ron.pipe';
import { ButtonComponent, LedgerRowComponent, StatusPillComponent } from '../../../../../shared/ui';
import { CLIENT_PLANS, Client, cleanDomain, statusInfo } from '../../clients.model';

/** One client in the ledger: salon, contact, package, status, actions. */
@Component({
  selector: 'app-client-row',
  standalone: true,
  imports: [LedgerRowComponent, StatusPillComponent, ButtonComponent, RonPipe],
  templateUrl: './client-row.component.html',
  styles: `
    :host { display: block; }
    .plan { display: block; font-weight: 600; }
    .contact { display: grid; font-size: 13.5px; }
    .contact a { color: var(--main); text-decoration: none; overflow-wrap: anywhere; }
    .contact a:hover { text-decoration: underline; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientRowComponent {
  readonly client = input.required<Client>();

  readonly edit = output<void>();
  readonly remove = output<void>();

  protected readonly status = computed(() => statusInfo(this.client().status));
  protected readonly planLabel = computed(() => (CLIENT_PLANS[this.client().plan] ?? CLIENT_PLANS.custom).label);
  protected readonly domain = computed(() => cleanDomain(this.client().domain));
  protected readonly sub = computed(() => [this.client().owner, this.client().city].filter(Boolean).join(' · '));
  protected readonly since = computed(() => formatDate(this.client().since));
  protected readonly hasContact = computed(() => {
    const c = this.client();
    return !!(c.phone || c.email || c.domain);
  });
}
