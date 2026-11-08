import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../../core/services/toast.service';
import { formatDate } from '../../../../core/utils/date';
import { ButtonComponent, PanelComponent, StatusPillComponent } from '../../../../shared/ui';
import { Recurring } from '../../../tools/finances/finances.model';
import { FinancesStore } from '../../../tools/finances/finances.store';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { t } from '../../../../core/i18n/i18n';
import { TcPipe } from '../../../../core/i18n/tc.pipe';

/** Recurring payments due within two weeks, with one-click "Log paid". */
@Component({
  selector: 'app-due-payments',
  standalone: true,
  imports: [TcPipe, TPipe, RouterLink, PanelComponent, ButtonComponent, StatusPillComponent],
  template: `
    <app-panel heading="Payments due" meta="Next 14 days" [flush]="true">
      <a panelAction routerLink="/tools/finances">{{ 'Finances' | t }}</a>
      @if (store.dueSoon().length) {
        <ul>
          @for (row of store.dueSoon(); track row.item.id) {
            <li>
              <div class="main">
                <span class="name">{{ (row.item.name | tc) || ('Recurring payment' | t) }}</span>
                <span class="sub">{{ row.amountText }} · {{ row.dueText }}</span>
              </div>
              <app-status-pill [tone]="row.dueTone">{{ row.dueLabel }}</app-status-pill>
              <button appButton size="sm" type="button" (click)="log(row.item)">{{ 'Log paid' | t }}</button>
            </li>
          }
        </ul>
      } @else {
        <p class="empty">{{ 'No recurring payments due in the next two weeks.' | t }}</p>
      }
    </app-panel>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    app-panel { height: 100%; }
    ul { list-style: none; padding: 0; }
    li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px;
      padding: 10px 18px; border-top: 1px solid var(--line); }
    li:first-child { border-top: 0; }
    .main { display: grid; min-width: 0; }
    .name { font-weight: 500; overflow-wrap: anywhere; }
    .sub { font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
    .empty { padding: 24px 18px; color: var(--muted); }
    @media (max-width: 420px) {
      li { grid-template-columns: minmax(0, 1fr) auto; }
      app-status-pill { grid-row: 2; justify-self: start; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DuePaymentsComponent {
  protected readonly store = inject(FinancesStore);
  private readonly toast = inject(ToastService);

  protected log(item: Recurring): void {
    const next = this.store.logRecurring(item);
    this.toast.show(t('Logged {name}. Next due {date}', { name: item.name || t('payment'), date: formatDate(next) }));
  }
}
