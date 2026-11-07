import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent, LedgerRowComponent, StatusPillComponent } from '../../../../../shared/ui';
import { salonStatus } from '../../../salons/salons.model';
import { Client } from '../../clients.model';

/** One client in the ledger: who pays, how to reach them, address, their salon. */
@Component({
  selector: 'app-client-row',
  standalone: true,
  imports: [LedgerRowComponent, StatusPillComponent, ButtonComponent, RouterLink],
  templateUrl: './client-row.component.html',
  styles: `
    :host { display: block; }
    .contact { display: grid; font-size: 13.5px; overflow-wrap: anywhere; }
    .address { font-size: 13.5px; overflow-wrap: anywhere; }
    .missing { color: var(--red); font-weight: 600; font-size: 13px; }
    .salon { display: grid; justify-items: start; gap: 4px; }
    .salon a { font-weight: 600; color: var(--main); text-decoration: none; }
    .salon a:hover { text-decoration: underline; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientRowComponent {
  readonly client = input.required<Client>();

  readonly edit = output<void>();
  readonly remove = output<void>();
  readonly addSalon = output<void>();

  protected readonly sub = computed(() => {
    const c = this.client();
    return [c.kind === 'person' ? 'Person' : 'Company', c.contactPerson, c.city].filter(Boolean).join(' · ');
  });
  protected readonly status = computed(() => salonStatus(this.client().salonStatus));
}
