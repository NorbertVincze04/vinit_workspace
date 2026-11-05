import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToolDefinition } from '../../../core/models';
import { BadgeComponent, ButtonComponent, CardComponent, IconComponent } from '../../ui';

/**
 * Launcher card for a workspace tool. Live tools link to their page; others show "Coming soon".
 *   <app-tool-card [tool]="tool" />
 */
@Component({
  selector: 'app-tool-card',
  standalone: true,
  imports: [RouterLink, CardComponent, BadgeComponent, ButtonComponent, IconComponent],
  template: `
    <app-card [tone]="isLive() ? 'default' : 'soft'" padding="lg">
      <div class="top">
        <span class="tile" [class.is-soon]="!isLive()"><app-icon [name]="tool().icon" [size]="22" /></span>
        @if (!isLive()) {
          <app-badge variant="muted">Coming soon</app-badge>
        }
      </div>
      <h3 class="title-sm">{{ tool().title }}</h3>
      <p class="muted">{{ tool().description }}</p>
      @if (isLive()) {
        <a appButton variant="primary" size="sm" class="open" [routerLink]="tool().route">
          Open {{ tool().title }} <app-icon name="arrow-right" [size]="16" />
        </a>
      }
    </app-card>
  `,
  styles: `
    :host { display: block; min-width: 0; height: 100%; }
    app-card { height: 100%; }
    .top { display: flex; justify-content: space-between; align-items: center; }
    .tile { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px;
      background: var(--main); color: var(--on-main); }
    .tile.is-soon { background: var(--surface); color: var(--muted); border: 1px solid var(--line); }
    .open { justify-self: start; margin-top: 4px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolCardComponent {
  readonly tool = input.required<ToolDefinition>();

  protected readonly isLive = computed(() => this.tool().status === 'live' && !!this.tool().route);
}
