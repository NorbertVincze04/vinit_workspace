import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, apiError } from '../../../core/api/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDateTime } from '../../../core/utils/date';
import { ButtonComponent, PanelComponent, StatusPillComponent } from '../../../shared/ui';

interface Integration {
  id: string;
  name: string;
  purpose: string;
  state: 'built_in' | 'not_configured' | 'configured_not_built';
  envVars: string[];
  missing: string[];
  note: string;
}

interface UptimeRow {
  salonId: string;
  salonName: string;
  domain: string;
  ok: boolean;
  status: number | null;
  ms: number;
  error?: string;
}

const STATE: Record<Integration['state'], { label: string; tone: 'ok' | 'info' | 'neutral' }> = {
  built_in: { label: 'Built in', tone: 'ok' },
  configured_not_built: { label: 'Set up · not built yet', tone: 'info' },
  not_configured: { label: 'Not set up', tone: 'neutral' },
};

/** Infra: which outside services are connected (credentials only in .env) and the uptime check. */
@Component({
  selector: 'app-integrations-panel',
  standalone: true,
  imports: [RouterLink, PanelComponent, StatusPillComponent, ButtonComponent],
  template: `
    <app-panel heading="Integrations" meta="Credentials only in .env">
      <ul class="list">
        @for (i of items(); track i.id) {
          <li>
            <div class="head">
              <strong>{{ i.name }}</strong>
              <app-status-pill [tone]="state(i).tone">{{ state(i).label }}</app-status-pill>
            </div>
            <span class="muted small">{{ i.purpose }}</span>
            <span class="small">{{ i.note }}</span>
            @if (i.missing.length) {
              <span class="vars small">Needs in .env: @for (v of i.missing; track v) {<code>{{ v }}</code>}</span>
            }
          </li>
        }
      </ul>

      <div class="uptime">
        <div class="bar">
          <strong>Salon sites</strong>
          <button appButton type="button" [disabled]="checking()" (click)="check()">{{ checking() ? 'Checking…' : 'Check now' }}</button>
        </div>
        @if (uptime(); as u) {
          <p class="muted small">{{ summary() }} · {{ when(u.checkedAt) }}</p>
          <ul class="rows">
            @for (r of u.items; track r.salonId) {
              <li>
                <app-status-pill [tone]="r.ok ? 'ok' : 'bad'">{{ r.ok ? 'Up' : 'Down' }}</app-status-pill>
                <a [routerLink]="['/tools/salons', r.salonId]">{{ r.salonName }}</a>
                <span class="muted small">{{ r.domain }} · {{ r.ok ? r.ms + ' ms' : (r.status ?? r.error) }}</span>
              </li>
            }
          </ul>
        } @else {
          <p class="muted small">Opens the primary domain of every trial and active salon from this PC.</p>
        }
      </div>
    </app-panel>
  `,
  styles: `
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    .list li { display: grid; gap: 2px; }
    .head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
    .vars { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; color: var(--muted); }
    code { font-size: 12px; padding: 1px 5px; background: var(--hover); border-radius: 4px; }
    .uptime { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }
    .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
    .rows { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 8px; font-size: 14px; }
    .rows li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
    .rows a { color: inherit; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationsPanelComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<Integration[]>([]);
  protected readonly uptime = signal<{ checkedAt: string; items: UptimeRow[] } | null>(null);
  protected readonly checking = signal(false);
  protected readonly when = formatDateTime;
  protected readonly state = (i: Integration) => STATE[i.state];

  protected readonly summary = computed(() => {
    const rows = this.uptime()?.items ?? [];
    if (!rows.length) return 'No trial or active salon has a primary domain yet';
    const down = rows.filter((r) => !r.ok).length;
    return down ? `${down} of ${rows.length} down` : `All ${rows.length} up`;
  });

  constructor() {
    this.api.get<{ items: Integration[] }>('/integrations/status').then(
      (res) => this.items.set(res.items),
      () => undefined,
    );
  }

  protected async check(): Promise<void> {
    this.checking.set(true);
    try {
      this.uptime.set(await this.api.write('POST', '/integrations/uptime/check'));
    } catch (error) {
      this.toast.show(`Could not check the sites: ${apiError(error).message}`, 6000);
    } finally {
      this.checking.set(false);
    }
  }
}
