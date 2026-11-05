import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type StatusTone = 'neutral' | 'info' | 'warn' | 'ok' | 'teal' | 'bad';

/**
 * Rounded status label with a coloured dot (colour + text, never colour alone).
 *   <app-status-pill tone="ok">Active</app-status-pill>
 */
@Component({
  selector: 'app-status-pill',
  standalone: true,
  template: '<ng-content />',
  styles: `
    :host { display: inline-flex; align-items: center; gap: 7px; padding: 3px 11px 3px 9px; font-size: 12.5px;
      font-weight: 600; white-space: nowrap; border-radius: var(--radius-pill);
      background: var(--tone-neutral-bg); color: var(--tone-neutral-fg); }
    :host::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }
    :host([data-tone='info']) { background: var(--tone-info-bg); color: var(--tone-info-fg); }
    :host([data-tone='warn']) { background: var(--tone-warn-bg); color: var(--tone-warn-fg); }
    :host([data-tone='ok']) { background: var(--tone-ok-bg); color: var(--tone-ok-fg); }
    :host([data-tone='teal']) { background: var(--tone-teal-bg); color: var(--tone-teal-fg); }
    :host([data-tone='bad']) { background: var(--tone-bad-bg); color: var(--tone-bad-fg); }
  `,
  host: { '[attr.data-tone]': 'tone()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPillComponent {
  readonly tone = input<StatusTone>('neutral');
}
