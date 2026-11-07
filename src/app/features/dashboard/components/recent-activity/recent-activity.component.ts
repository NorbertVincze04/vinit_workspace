import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/api/api.service';
import { ActivityEntry } from '../../../../core/data/activity.data';
import { PanelComponent } from '../../../../shared/ui';
import { ActivityListComponent } from '../../../activity/activity-list.component';

/** Overview: the last changes in the workspace. */
@Component({
  selector: 'app-recent-activity',
  standalone: true,
  imports: [RouterLink, PanelComponent, ActivityListComponent],
  template: `
    <app-panel heading="Recent activity">
      <a panelAction routerLink="/activity">See all</a>
      @if (items().length) {
        <app-activity-list [items]="items()" />
      } @else {
        <p class="muted small">Nothing yet. Changes made by the team show up here.</p>
      }
    </app-panel>
  `,
  styles: ':host { display: block; min-width: 0; } app-panel { height: 100%; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentActivityComponent {
  private readonly api = inject(ApiService);
  protected readonly items = signal<ActivityEntry[]>([]);

  constructor() {
    this.api.get<{ items: ActivityEntry[] }>('/activity', { limit: 8 }).then(
      (res) => this.items.set(res.items),
      () => undefined,
    );
  }
}
