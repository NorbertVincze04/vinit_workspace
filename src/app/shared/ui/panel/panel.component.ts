import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Titled card for a block of a page: heading, optional meta text / action on the right, body below.
 *   <app-panel heading="Due now" meta="5 tasks">
 *     <a panelAction routerLink="/tools/tasks">View all</a>
 *     …body…
 *   </app-panel>
 */
@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [TPipe],
  template: `
    <header>
      <h2>{{ heading() | t }}</h2>
      @if (meta()) {
        <span class="meta">{{ meta() | t }}</span>
      }
      <span class="action"><ng-content select="[panelAction]" /></span>
    </header>
    <div class="body" [class.flush]="flush()"><ng-content /></div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-width: 0; background: var(--surface); border: 1px solid var(--line);
      border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
    header { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 10px 16px 10px 18px;
      border-bottom: 1px solid var(--line); }
    h2 { font-size: 14px; font-weight: 600; }
    .meta { font-size: 12.5px; color: var(--muted); }
    .action { margin-left: auto; display: inline-flex; }
    .action:empty { display: none; }
    .action ::ng-deep a[panelAction] { font-size: 13px; font-weight: 500; color: var(--main); text-decoration: none; }
    .action ::ng-deep a[panelAction]:hover { text-decoration: underline; }
    .body { flex: 1; display: grid; align-content: start; gap: 12px; padding: 16px 18px; }
    .body.flush { padding: 0; gap: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelComponent {
  readonly heading = input.required<string>();
  readonly meta = input('');
  /** Remove the body padding (for edge-to-edge lists). */
  readonly flush = input(false);
}
