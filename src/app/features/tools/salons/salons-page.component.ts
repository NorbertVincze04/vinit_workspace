import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import {
  ButtonComponent,
  ChipGroupComponent,
  EmptyStateComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  IconComponent,
  InlineStat,
  InlineStatsComponent,
  LedgerComponent,
  PageHeaderComponent,
  TextFieldComponent,
} from '../../../shared/ui';
import { ClientsStore } from '../clients/clients.store';
import { LegacyClientsBannerComponent } from './components/legacy-clients-banner/legacy-clients-banner.component';
import { SalonRowComponent } from './components/salon-row/salon-row.component';
import { PlansStore } from './plans.store';
import { newSalonBody, newSalonFields } from './salons.fields';
import { Salon } from './salons.model';
import { SalonsStore } from './salons.store';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/** Salons tool: every salon (tenant) with its client, plan and status. Each row opens the salon's story. */
@Component({
  selector: 'app-salons-page',
  standalone: true,
  imports: [TPipe, 
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    TextFieldComponent,
    ChipGroupComponent,
    InlineStatsComponent,
    LedgerComponent,
    EmptyStateComponent,
    FormDialogComponent,
    SalonRowComponent,
    LegacyClientsBannerComponent,
  ],
  templateUrl: './salons-page.component.html',
  styles: '.summary { display: flex; margin-bottom: 12px; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalonsPageComponent {
  protected readonly store = inject(SalonsStore);
  private readonly clients = inject(ClientsStore);
  private readonly plans = inject(PlansStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly form = signal<FieldDef[] | null>(null);

  protected readonly summary = computed<InlineStat[]>(() => {
    const stats: InlineStat[] = [
      { label: 'Active', value: String(this.store.statusCount('active')) },
      { label: 'Trial', value: String(this.store.statusCount('trial')) },
      { label: 'Paused', value: String(this.store.statusCount('paused')) },
      { label: 'Churned', value: String(this.store.statusCount('churned')) },
    ];
    const left = this.plans.earlyBirdLeft();
    if (left !== null) stats.push({ label: 'Early Bird places left', value: String(left), tone: left <= 5 ? 'negative' : 'default' });
    return stats;
  });

  protected openNew(): void {
    this.form.set(newSalonFields(this.clients.withoutSalon(), this.plans.plans()));
  }

  protected async save(values: FormValues): Promise<void> {
    try {
      const salon = await this.store.create(newSalonBody(values));
      this.toast.show(t('Added {name}', { name: salon.name }));
      void this.router.navigate(['/tools/salons', salon.id]);
    } catch {
      /* toast shown by the store */
    }
  }

  protected open(salon: Salon): void {
    void this.router.navigate(['/tools/salons', salon.id]);
  }
}
