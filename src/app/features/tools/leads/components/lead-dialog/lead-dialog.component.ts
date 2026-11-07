import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiError } from '../../../../../core/api/api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { formatDate, formatDateTime } from '../../../../../core/utils/date';
import {
  ButtonComponent,
  DialogComponent,
  Fact,
  FactsComponent,
  SegmentedComponent,
  StatusPillComponent,
} from '../../../../../shared/ui';
import { ACTIVITY_KINDS, LEAD_STAGES, Lead, LeadActivity, LeadStage, OPEN_STAGES, kindLabel, lostLabel, sourceLabel, stageInfo } from '../../leads.model';
import { LeadsStore } from '../../leads.store';

/**
 * A lead's card opened: details, every contact so far, a quick "log a contact" box and the
 * actions (move, edit, convert into a salon, delete). Forms that need more fields are opened by
 * the page through the outputs.
 */
@Component({
  selector: 'app-lead-dialog',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, FactsComponent, SegmentedComponent, StatusPillComponent, RouterLink],
  templateUrl: './lead-dialog.component.html',
  styleUrl: './lead-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadDialogComponent {
  readonly leadId = input.required<string>();

  readonly edit = output<Lead>();
  readonly convert = output<Lead>();
  readonly lost = output<Lead>();
  readonly remove = output<Lead>();
  readonly closed = output<void>();

  private readonly store = inject(LeadsStore);
  private readonly toast = inject(ToastService);

  protected readonly lead = computed(() => this.store.get(this.leadId()) ?? null);
  protected readonly activities = signal<LeadActivity[] | null>(null);
  protected readonly kind = signal('dm');
  protected readonly note = signal('');
  protected readonly followUp = signal('');
  protected readonly saving = signal(false);

  protected readonly kinds = ACTIVITY_KINDS;
  protected readonly moveOptions = LEAD_STAGES.filter((s) => OPEN_STAGES.includes(s.value));
  protected readonly stage = computed(() => stageInfo(this.lead()?.stage ?? 'contacted'));

  protected readonly facts = computed<Fact[]>(() => {
    const l = this.lead();
    if (!l) return [];
    const facts: Fact[] = [
      { label: 'Contact', value: l.contactName },
      { label: 'City', value: l.city },
      { label: 'Phone', value: l.phone, href: l.phone ? `tel:${l.phone.replace(/\s/g, '')}` : undefined },
      { label: 'Email', value: l.email, href: l.email ? `mailto:${l.email}` : undefined },
      {
        label: 'Instagram',
        value: l.instagram,
        href: l.instagram ? `https://instagram.com/${l.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}` : undefined,
      },
      { label: 'Website', value: l.website, href: l.website ? (/^https?:\/\//.test(l.website) ? l.website : `https://${l.website}`) : undefined },
      { label: 'Barbers / staff', value: l.employees ? String(l.employees) : '' },
      { label: 'Services', value: l.services },
      { label: 'Source', value: [sourceLabel(l.source), l.sourceDetail].filter(Boolean).join(' · ') },
      { label: 'Interested in', value: l.interestedPlanName },
      { label: 'Next follow-up', value: formatDate(l.nextFollowUpOn) },
      { label: 'Demo', value: formatDateTime(l.demoAt) },
      { label: 'Owner', value: l.ownerName },
    ];
    if (l.stage === 'lost') facts.push({ label: 'Lost because', value: lostLabel(l.lostReason), hint: l.lostNote });
    return facts;
  });

  constructor() {
    effect(
      () => {
        const id = this.leadId();
        untracked(() => void this.load(id));
      },
      { allowSignalWrites: true },
    );
  }

  private async load(id: string): Promise<void> {
    try {
      this.activities.set((await this.store.detail(id)).activities);
    } catch (e) {
      this.toast.show(`Could not load the lead: ${apiError(e).message}`, 6000);
    }
  }

  protected kindLabel = kindLabel;
  protected stageLabel = (s: string | null) => (s ? stageInfo(s).label : '');
  protected formatDateTime = formatDateTime;

  protected async logContact(): Promise<void> {
    const l = this.lead();
    const body = this.note().trim();
    if (!l || !body) return;
    this.saving.set(true);
    try {
      await this.store.addActivity(l.id, { kind: this.kind(), body });
      if (this.followUp()) await this.store.update(l.id, { nextFollowUpOn: this.followUp() });
      this.note.set('');
      this.followUp.set('');
      await this.load(l.id);
    } catch {
      /* toast shown by the store */
    } finally {
      this.saving.set(false);
    }
  }

  protected async moveTo(select: HTMLSelectElement): Promise<void> {
    const l = this.lead();
    const stage = select.value;
    // The select shows the lead's real stage until the server has moved it.
    if (l) select.value = l.stage;
    if (!l || stage === l.stage) return;
    if (stage === 'lost') {
      this.lost.emit(l);
      return;
    }
    if (await this.store.move(l.id, stage as LeadStage, undefined)) await this.load(l.id);
  }

  protected onInput(target: 'note' | 'followUp', event: Event): void {
    this[target].set((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  /** Reload after a change made by the page (edit, lost, convert). */
  refresh(): void {
    void this.load(this.leadId());
  }
}
