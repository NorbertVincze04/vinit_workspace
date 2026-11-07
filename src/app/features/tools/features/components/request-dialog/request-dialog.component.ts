import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiError } from '../../../../../core/api/api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { formatDate } from '../../../../../core/utils/date';
import { formatRon, plural } from '../../../../../core/utils/format';
import { ButtonComponent, DialogComponent, Fact, FactsComponent, StatusPillComponent } from '../../../../../shared/ui';
import { LeadsStore } from '../../../leads/leads.store';
import { SalonsStore } from '../../../salons/salons.store';
import { ticketNo } from '../../../support/support.model';
import { FeatureRequest, REQUEST_STATUSES, Vote, requestStatus } from '../../features.model';
import { FeaturesStore } from '../../features.store';

/** One request: status, roadmap link, who asked (salons and leads) and linked tickets. */
@Component({
  selector: 'app-request-dialog',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, FactsComponent, StatusPillComponent, RouterLink],
  template: `
    <app-dialog #dialog size="lg" [heading]="item()?.title ?? 'Feature request'" (closed)="closed.emit()">
      @if (item(); as r) {
        <div class="top">
          <label class="pick">
            <span>Status</span>
            <select class="input" (change)="setStatus($any($event.target))">
              @for (s of statuses; track s.value) {
                <option [value]="s.value" [selected]="s.value === r.status">{{ s.label }}</option>
              }
            </select>
          </label>
          <label class="pick">
            <span>Roadmap step</span>
            <select class="input" (change)="setStep($any($event.target).value)">
              <option value="" [selected]="!r.roadmapStepId">None</option>
              @for (s of store.steps(); track s.id) {
                <option [value]="s.id" [selected]="s.id === r.roadmapStepId">{{ s.id }} · {{ s.text }}</option>
              }
            </select>
          </label>
        </div>
        <app-facts [items]="facts()" />
        @if (r.description) {
          <p class="desc">{{ r.description }}</p>
        }

        <h3>Who asked ({{ r.votes }})</h3>
        <ul class="votes">
          @for (v of r.voteList ?? []; track v.id) {
            <li>
              @if (v.salonId) {
                <a [routerLink]="['/tools/salons', v.salonId]" (click)="dialog.close()">{{ v.salonName }}</a>
                <span class="muted">salon · {{ v.salonStatus }}</span>
              } @else {
                <span>{{ v.leadName }}</span>
                <span class="muted">lead · {{ v.leadStage }}</span>
              }
              @if (v.note) {
                <span class="note">“{{ v.note }}”</span>
              }
              <button class="remove" type="button" [attr.aria-label]="'Remove the vote of ' + (v.salonName || v.leadName)" (click)="unvote(v)">×</button>
            </li>
          } @empty {
            <li class="muted">Nobody yet.</li>
          }
        </ul>
        <form class="add" (submit)="$event.preventDefault(); vote()">
          <select class="input" aria-label="Salon or lead that asks for it" (change)="who.set($any($event.target).value)">
            <option value="">Add a salon or lead…</option>
            <optgroup label="Salons">
              @for (s of salonOptions(); track s.id) {
                <option [value]="'s:' + s.id">{{ s.name }}</option>
              }
            </optgroup>
            <optgroup label="Leads">
              @for (l of leadOptions(); track l.id) {
                <option [value]="'l:' + l.id">{{ l.businessName }}</option>
              }
            </optgroup>
          </select>
          <input class="input" maxlength="1000" placeholder="What they said (optional)" aria-label="Note" [value]="note()" (input)="note.set($any($event.target).value)" />
          <button appButton size="sm" type="submit" [disabled]="!who()">Add</button>
        </form>

        @if (r.ticketList?.length) {
          <h3>Tickets</h3>
          <ul class="votes">
            @for (t of r.ticketList; track t.id) {
              <li>{{ no(t.number) }} {{ t.title }} <span class="muted">· {{ t.salonName }} · {{ t.status }}</span></li>
            }
          </ul>
        }
      } @else {
        <p class="muted">Loading…</p>
      }
      <div dialogFooter class="footer">
        @if (item(); as r) {
          <button appButton variant="ghost" type="button" (click)="remove.emit(r)">Delete</button>
          <span class="spacer"></span>
          <button appButton type="button" (click)="edit.emit(r)">Edit</button>
        }
      </div>
    </app-dialog>
  `,
  styles: `
    .top { display: flex; flex-wrap: wrap; gap: 10px 20px; margin-bottom: 14px; }
    .pick { display: grid; gap: 4px; font-size: 12.5px; color: var(--muted); min-width: 0; flex: 1 1 220px; }
    .desc { white-space: pre-line; font-size: 14px; margin-top: 14px; }
    h3 { font-size: 14px; font-weight: 600; margin: 18px 0 8px; }
    .votes { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 14px; }
    .votes li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; }
    .votes a { font-weight: 600; color: var(--main); text-decoration: none; }
    .note { color: var(--muted); font-style: italic; }
    .remove { margin-left: auto; width: 28px; height: 28px; font-size: 18px; color: var(--muted); background: none; border: 0; border-radius: var(--radius-md); cursor: pointer; opacity: 0.5; }
    .remove:hover, .remove:focus-visible { opacity: 1; background: var(--hover); }
    .add { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .add select { flex: 1 1 200px; }
    .add input { flex: 2 1 200px; }
    .footer { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; }
    .spacer { flex: 1; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestDialogComponent {
  readonly requestId = input.required<string>();
  readonly edit = output<FeatureRequest>();
  readonly remove = output<FeatureRequest>();
  readonly closed = output<void>();

  protected readonly store = inject(FeaturesStore);
  private readonly salons = inject(SalonsStore);
  private readonly leads = inject(LeadsStore);
  private readonly toast = inject(ToastService);

  protected readonly item = signal<FeatureRequest | null>(null);
  protected readonly who = signal('');
  protected readonly note = signal('');
  protected readonly statuses = REQUEST_STATUSES;
  protected readonly no = ticketNo;

  protected readonly salonOptions = computed(() => {
    const voted = new Set((this.item()?.voteList ?? []).map((v) => v.salonId));
    return this.salons.salons().filter((s) => !voted.has(s.id) && s.status !== 'churned');
  });
  protected readonly leadOptions = computed(() => {
    const voted = new Set((this.item()?.voteList ?? []).map((v) => v.leadId));
    return this.leads.leads().filter((l) => !voted.has(l.id) && this.leads.isOpen(l));
  });

  protected readonly facts = computed<Fact[]>(() => {
    const r = this.item();
    if (!r) return [];
    const s = requestStatus(r.status);
    return [
      { label: 'Status', value: s.label, tone: s.tone },
      { label: 'Asked by', value: `${r.salonVotes} ${plural(r.salonVotes, 'salon', 'salons')} · ${r.votes - r.salonVotes} ${plural(r.votes - r.salonVotes, 'lead', 'leads')}` },
      { label: 'MRR behind it', value: formatRon(r.mrrBani / 100), hint: 'paying salons that asked' },
      { label: 'Shipped', value: formatDate(r.shippedOn) },
      { label: 'Added', value: formatDate(r.createdAt.slice(0, 10)) },
    ];
  });

  constructor() {
    effect(
      () => {
        const id = this.requestId();
        untracked(() => void this.load(id));
      },
      { allowSignalWrites: true },
    );
  }

  refresh(): void {
    void this.load(this.requestId());
  }

  private async load(id: string): Promise<void> {
    try {
      this.item.set(await this.store.get(id));
    } catch (e) {
      this.toast.show(`Could not load the request: ${apiError(e).message}`, 6000);
    }
  }

  protected async setStatus(select: HTMLSelectElement): Promise<void> {
    const r = this.item();
    if (!r || select.value === r.status) return;
    await this.run(() => this.store.update(r.id, { status: select.value }), `Marked ${requestStatus(select.value).label.toLowerCase()}`);
  }

  protected async setStep(stepId: string): Promise<void> {
    const r = this.item();
    if (!r) return;
    await this.run(() => this.store.update(r.id, { roadmapStepId: stepId || null }));
  }

  protected async vote(): Promise<void> {
    const r = this.item();
    const who = this.who();
    if (!r || !who) return;
    const [kind, id] = who.split(':');
    await this.run(() => this.store.vote(r.id, { [kind === 's' ? 'salonId' : 'leadId']: id, note: this.note().trim() }), 'Added');
    this.who.set('');
    this.note.set('');
  }

  protected async unvote(v: Vote): Promise<void> {
    await this.run(() => this.store.unvote(v.id));
  }

  private async run(action: () => Promise<FeatureRequest>, message?: string): Promise<void> {
    try {
      this.item.set(await action());
      if (message) this.toast.show(message);
    } catch {
      this.refresh();
    }
  }
}
