import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { fromApi } from '../../../../core/api/api-fields';
import { apiError } from '../../../../core/api/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { formatDate, formatDateTime, toLocalDateTime } from '../../../../core/utils/date';
import {
  ButtonComponent,
  ChipOption,
  ConfirmDialogComponent,
  EmptyStateComponent,
  Fact,
  FactsComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  IconComponent,
  LedgerComponent,
  LedgerRowComponent,
  MenuComponent,
  MenuItemComponent,
  PageHeaderComponent,
  PanelComponent,
  StatusPillComponent,
  TabsComponent,
  toFormValues,
} from '../../../../shared/ui';
import { CLIENT_FIELDS, clientBody } from '../../clients/clients.fields';
import { Client } from '../../clients/clients.model';
import { ClientsStore } from '../../clients/clients.store';
import { PlansStore } from '../plans.store';
import {
  DOMAIN_FIELDS,
  STATUS_FIELDS,
  domainBody,
  editSalonFields,
  editSalonPatch,
  statusBody,
} from '../salons.fields';
import {
  DEPLOY_STATUSES,
  DNS_STATUSES,
  SALON_FIELD_MAP,
  SSL_STATUSES,
  Salon,
  SalonDomain,
  SalonOverview,
  TimelineEntry,
  activityLabel,
  clientFromOverview,
  labelOf,
  salonStatus,
} from '../salons.model';
import { SalonsStore } from '../salons.store';
import { kindLabel, sourceLabel, stageInfo } from '../../leads/leads.model';
import { SalonBilling } from '../../subscriptions/billing.model';
import { BillingDialogsComponent, BillingRequest } from '../../subscriptions/components/billing-dialogs/billing-dialogs.component';
import { SalonBillingComponent } from './salon-billing.component';
import { SalonSupportComponent } from './salon-support.component';
import { SalonSupport } from '../../support/support.model';
import { OnboardingChecklistComponent } from '../../onboarding/components/onboarding-checklist/onboarding-checklist.component';
import { Onboarding } from '../../onboarding/onboarding.model';
import { OnboardingStore } from '../../onboarding/onboarding.store';

interface SalonLead {
  id: string;
  source: string;
  sourceDetail: string;
  createdAt: string;
  convertedAt: string | null;
  ownerName: string | null;
  activities: { id: string; kind: string; body: string; occurredAt: string; fromStage: string | null; toStage: string | null; userName: string | null }[];
}

type Dialog =
  | { kind: 'salon'; fields: FieldDef[]; values: FormValues }
  | { kind: 'client'; values: FormValues }
  | { kind: 'status'; values: FormValues }
  | { kind: 'domain'; domain: SalonDomain | null; values: FormValues };

/**
 * /tools/salons/:id — one salon's whole story: who pays, plan, domains, status history and every
 * change made to it. Later modules (subscription, onboarding, support) add their own tabs.
 */
@Component({
  selector: 'app-salon-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    MenuComponent,
    MenuItemComponent,
    TabsComponent,
    PanelComponent,
    FactsComponent,
    LedgerComponent,
    LedgerRowComponent,
    StatusPillComponent,
    EmptyStateComponent,
    FormDialogComponent,
    ConfirmDialogComponent,
    SalonBillingComponent,
    BillingDialogsComponent,
    OnboardingChecklistComponent,
    SalonSupportComponent,
  ],
  templateUrl: './salon-detail-page.component.html',
  styleUrl: './salon-detail-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalonDetailPageComponent {
  /** Route parameter. */
  readonly id = input.required<string>();
  /** Optional ?tab= query parameter (e.g. links from the Onboarding page). */
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  private readonly store = inject(SalonsStore);
  private readonly clients = inject(ClientsStore);
  private readonly plans = inject(PlansStore);
  private readonly onboardings = inject(OnboardingStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly data = signal<SalonOverview | null>(null);
  protected readonly error = signal('');
  protected readonly timeline = signal<TimelineEntry[] | null>(null);
  protected readonly tab = signal('overview');
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly billingRequest = signal<BillingRequest | null>(null);
  protected readonly onboarding = computed(() => (this.data()?.['onboarding'] as Onboarding | null | undefined) ?? null);
  protected readonly support = computed(() => (this.data()?.['support'] as SalonSupport | undefined) ?? null);
  protected readonly billing = computed(() => (this.data()?.['billing'] as SalonBilling | undefined) ?? null);
  protected readonly deleting = signal<'salon' | SalonDomain | null>(null);

  protected readonly salon = computed<Salon | null>(() => {
    const d = this.data();
    return d ? fromApi<Salon>(SALON_FIELD_MAP, d.salon) : null;
  });
  protected readonly client = computed(() => {
    const d = this.data();
    return d ? clientFromOverview(d.client) : null;
  });
  protected readonly status = computed(() => salonStatus(this.salon()?.status ?? 'lead'));
  /** The lead this salon was converted from, with its contact history. */
  protected readonly lead = computed(() => (this.data()?.['lead'] as SalonLead | null | undefined) ?? null);
  protected readonly subtitle = computed(() => {
    const s = this.salon();
    return s ? [s.clientName, s.city, s.primaryDomain].filter(Boolean).join(' · ') : '';
  });

  protected readonly tabs = computed<ChipOption[]>(() => [
    { value: 'overview', label: 'Overview' },
    { value: 'onboarding', label: this.onboarding()?.status === 'done' ? 'Onboarding ✓' : 'Onboarding' },
    { value: 'billing', label: 'Subscription & payments', count: this.billing()?.payments.filter((p) => p['status'] === 'due').length || undefined },
    { value: 'support', label: 'Support & time', count: this.support()?.tickets.filter((t) => ['open', 'in_progress', 'waiting_client'].includes(t.status)).length || undefined },
    { value: 'timeline', label: 'Timeline' },
  ]);

  protected readonly salonFacts = computed<Fact[]>(() => {
    const s = this.salon();
    if (!s) return [];
    const deploy = labelOf(DEPLOY_STATUSES, s.deployStatus);
    const referrer = s.referredBySalonId ? this.store.get(s.referredBySalonId) : undefined;
    const facts: Fact[] = [
      { label: 'Status', value: this.status().label, tone: this.status().tone },
      { label: 'Plan', value: s.planName },
      { label: 'City', value: s.city },
      { label: 'Tenant slug', value: s.tenantSlug, hint: 'shops.slug in the booking product' },
      { label: 'Signed', value: formatDateTime(s.signedAt) },
      { label: 'Went live', value: formatDate(s.goLiveOn) },
      { label: 'Deploy', value: deploy.label, tone: deploy.tone, hint: s.deployedAt ? `since ${formatDateTime(s.deployedAt)}` : '' },
      {
        label: 'JSON config',
        value: s.configVersion || (s.configUrl ? 'Open' : ''),
        href: s.configUrl || undefined,
        hint: s.configUpdatedAt ? `updated ${formatDateTime(s.configUpdatedAt)}` : '',
      },
      { label: 'Uptime monitor', value: s.uptimeMonitorId },
      { label: 'Referred by', value: referrer?.name ?? '', route: referrer ? `/tools/salons/${referrer.id}` : undefined },
    ];
    if (s.status === 'churned') facts.push({ label: 'Left on', value: formatDate(s.churnedOn), hint: s.churnReason });
    return facts;
  });

  protected readonly clientFacts = computed<Fact[]>(() => {
    const c = this.client();
    if (!c) return [];
    return [
      { label: 'Name', value: c.name ?? '' },
      { label: 'Type', value: c.kind === 'person' ? 'Person' : 'Company' },
      { label: 'Contact person', value: c.contactPerson ?? '' },
      { label: 'Phone', value: c.phone ?? '', href: c.phone ? `tel:${c.phone.replace(/\s/g, '')}` : undefined },
      { label: 'Email', value: c.email ?? '', href: c.email ? `mailto:${c.email}` : undefined },
      { label: 'Billing email', value: c.billingEmail ?? '' },
      {
        label: 'Business address',
        value: c.businessAddress || 'Missing: add it before invoicing',
        warn: !c.businessAddress,
      },
      { label: 'City', value: c.city ?? '' },
    ];
  });

  constructor() {
    effect(
      () => {
        const id = this.id();
        untracked(() => void this.load(id));
      },
      { allowSignalWrites: true },
    );
    effect(
      () => {
        const t = this.tabParam();
        if (t) untracked(() => this.tab.set(t));
      },
      { allowSignalWrites: true },
    );
    // The timeline is read when its tab opens (and again after each change).
    effect(
      () => {
        if (this.tab() === 'timeline') untracked(() => void this.loadTimeline());
      },
      { allowSignalWrites: true },
    );
  }

  protected async load(id = this.id()): Promise<void> {
    try {
      this.data.set(await this.store.overview(id));
      this.error.set('');
    } catch (e) {
      this.error.set(apiError(e).message);
    }
    if (this.tab() === 'timeline') void this.loadTimeline();
  }

  private async loadTimeline(): Promise<void> {
    try {
      this.timeline.set(await this.store.timeline(this.id()));
    } catch (e) {
      this.toast.show(`Could not load the timeline: ${apiError(e).message}`, 6000);
    }
  }

  // ---- display helpers ----

  protected dns = (v: string) => labelOf(DNS_STATUSES, v);
  protected ssl = (v: string) => labelOf(SSL_STATUSES, v);
  protected statusOf = salonStatus;
  protected sourceLabel = sourceLabel;
  protected kindLabel = kindLabel;
  protected stageLabel = (s: string | null) => (s ? stageInfo(s).label : '');
  protected activityLabel = activityLabel;
  protected formatDate = formatDate;
  protected formatDateTime = formatDateTime;

  // ---- dialogs ----

  protected editSalon(): void {
    const s = this.salon();
    if (!s) return;
    const others = this.store.salons().filter((x) => x.id !== s.id);
    this.dialog.set({
      kind: 'salon',
      fields: editSalonFields(this.plans.plans(), others),
      values: { ...toFormValues(s), signedAt: toLocalDateTime(s.signedAt) },
    });
  }

  protected editClient(): void {
    this.dialog.set({ kind: 'client', values: toFormValues(this.client()) });
  }

  protected changeStatus(): void {
    this.dialog.set({ kind: 'status', values: { status: this.salon()?.status ?? 'trial' } });
  }

  protected editDomain(domain: SalonDomain | null): void {
    this.dialog.set({ kind: 'domain', domain, values: domain ? toFormValues(domain) : { isPrimary: !this.data()?.domains.length } });
  }

  protected readonly clientFields = CLIENT_FIELDS;
  protected readonly statusFields = STATUS_FIELDS;
  protected readonly domainFields = DOMAIN_FIELDS;

  protected async saved(values: FormValues): Promise<void> {
    const d = this.dialog();
    const s = this.salon();
    if (!d || !s) return;
    try {
      switch (d.kind) {
        case 'salon':
          await this.store.update(s.id, editSalonPatch(values, s));
          this.toast.show('Salon saved');
          break;
        case 'client':
          await this.clients.update(s.clientId, clientBody(values) as Partial<Client>);
          this.toast.show('Client saved');
          break;
        case 'status': {
          const body = statusBody(values);
          if (body.status === s.status) return;
          await this.store.setStatus(s.id, body);
          this.toast.show(`${s.name} is now ${salonStatus(body.status).label.toLowerCase()}`);
          break;
        }
        case 'domain':
          if (d.domain) await this.store.updateDomain(s.id, d.domain.id, domainBody(values));
          else await this.store.addDomain(s.id, domainBody(values));
          this.toast.show('Domain saved');
          break;
      }
    } catch {
      /* the store showed the server's message */
    }
    await this.load();
  }

  protected async startOnboarding(): Promise<void> {
    const s = this.salon();
    if (!s) return;
    try {
      await this.onboardings.start(s.id, {});
      this.toast.show('Onboarding started');
      await this.load();
    } catch {
      /* toast shown */
    }
  }

  protected async confirmDelete(): Promise<void> {
    const target = this.deleting();
    const s = this.salon();
    if (!target || !s) return;
    try {
      if (target === 'salon') {
        await this.store.remove(s.id);
        this.toast.show(`Deleted ${s.name}`);
        void this.router.navigate(['/tools/salons']);
        return;
      }
      await this.store.removeDomain(s.id, target.id);
      this.toast.show(`Removed ${target.domain}`);
      await this.load();
    } catch {
      /* toast shown */
    }
  }

  protected deleteMessage(target: 'salon' | SalonDomain): string {
    return target === 'salon'
      ? `“${this.salon()?.name}”, its domains and history will be removed. Salons with subscriptions, payments or tickets can't be deleted: mark them churned instead.`
      : `“${target.domain}” will be removed from this salon.`;
  }
}
