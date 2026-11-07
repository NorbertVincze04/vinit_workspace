import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToolDefinition } from '../../../../core/models';
import { IconComponent } from '../../../../shared/ui';

/** Launcher tile for one workspace tool: icon, name and a one-line description. */
@Component({
  selector: 'app-tool-tile',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <a [routerLink]="tool().route">
      <span class="icon"><app-icon [name]="tool().icon" [size]="20" /></span>
      <span class="text">
        <span class="name">{{ tool().title }}</span>
        <span class="desc">{{ tool().description }}</span>
      </span>
    </a>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    a { display: flex; align-items: center; gap: 12px; height: 100%; padding: 14px 16px; color: var(--ink);
      text-decoration: none; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm); transition: border-color 0.12s ease, box-shadow 0.12s ease; }
    a:hover { border-color: var(--line-strong); box-shadow: var(--shadow-md); }
    .icon { display: grid; place-items: center; flex: none; width: 38px; height: 38px; color: var(--main-ink);
      background: var(--main-soft); border-radius: var(--radius-md); }
    .text { display: grid; min-width: 0; }
    .name { font-weight: 600; }
    .desc { font-size: 12.5px; line-height: 1.4; color: var(--muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolTileComponent {
  readonly tool = input.required<ToolDefinition>();
}
