import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { ApiService, apiError } from '../../core/api/api.service';
import { TeamService } from '../../core/auth/team.service';
import { ACTIVITY_AREAS, ActivityEntry } from '../../core/data/activity.data';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent, ChipGroupComponent, EmptyStateComponent, PageHeaderComponent, PanelComponent, SelectFieldComponent } from '../../shared/ui';
import { ActivityListComponent } from './activity-list.component';

/** /activity — everything the team changed, newest first, by area and person. */
@Component({
  selector: 'app-activity-page',
  standalone: true,
  imports: [PageHeaderComponent, ChipGroupComponent, SelectFieldComponent, PanelComponent, ButtonComponent, EmptyStateComponent, ActivityListComponent],
  template: `
    <app-page-header title="Activity" description="Everything that changed in the workspace, by whom. Each line opens where it happened." />
    <div class="toolbar">
      <app-chip-group label="Area" [options]="areas" [(value)]="area" />
      <app-select-field class="push" label="Person" labelMode="hidden" [options]="people()" [value]="userId()" (valueChange)="userId.set($event)" />
    </div>
    @if (items().length) {
      <app-panel heading="Changes" [meta]="items().length + (next() ? '+' : '')">
        <app-activity-list [items]="items()" />
        @if (next()) {
          <button appButton type="button" [disabled]="loading()" (click)="more()">{{ loading() ? 'Loading…' : 'Show older' }}</button>
        }
      </app-panel>
    } @else if (loading()) {
      <app-empty-state heading="Loading…" text="" />
    } @else {
      <app-empty-state heading="Nothing here" text="No change matches these filters." />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityPageComponent {
  private readonly api = inject(ApiService);
  private readonly team = inject(TeamService);
  private readonly toast = inject(ToastService);

  protected readonly areas = ACTIVITY_AREAS;
  protected readonly area = signal('all');
  protected readonly userId = signal('');
  protected readonly items = signal<ActivityEntry[]>([]);
  protected readonly next = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly people = () => [{ value: '', label: 'Everyone' }, ...this.team.options()];

  constructor() {
    effect(
      () => {
        const area = this.area();
        const userId = this.userId();
        untracked(() => void this.load(area, userId, null));
      },
      { allowSignalWrites: true },
    );
  }

  protected more(): void {
    void this.load(this.area(), this.userId(), this.next());
  }

  private async load(area: string, userId: string, before: string | null): Promise<void> {
    this.loading.set(true);
    try {
      const params: Record<string, string> = { limit: '60' };
      if (area !== 'all') params['area'] = area;
      if (userId) params['userId'] = userId;
      if (before) params['before'] = before;
      const res = await this.api.get<{ items: ActivityEntry[]; next: string | null }>('/activity', params);
      this.items.set(before ? [...this.items(), ...res.items] : res.items);
      this.next.set(res.next);
    } catch (error) {
      this.toast.show(`Could not load the activity: ${apiError(error).message}`, 6000);
    } finally {
      this.loading.set(false);
    }
  }
}
