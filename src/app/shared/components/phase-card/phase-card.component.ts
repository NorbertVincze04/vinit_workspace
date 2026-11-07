import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { phaseRange } from '../../../core/data/phases.data';
import { Phase } from '../../../core/models';
import { BadgeComponent, ProgressBarComponent } from '../../ui';

/**
 * Column for one Year-1 phase: name, months, goal and progress. The list inside is projected,
 * so Roadmap and Tasks each render their own items.
 *   <app-phase-card [phase]="phase" [done]="2" [total]="6" unit="steps" current> <ul>…</ul> </app-phase-card>
 */
@Component({
  selector: 'app-phase-card',
  standalone: true,
  imports: [BadgeComponent, ProgressBarComponent],
  template: `
    <header>
      <div class="title">
        <h2>{{ phase().name }}</h2>
        <span class="range">{{ range() }}</span>
        @if (current()) {
          <app-badge class="now">Current</app-badge>
        }
      </div>
      <p class="goal">{{ phase().goal }}</p>
      <div class="progress">
        <app-progress-bar size="xs" [value]="percent()" [label]="phase().name + ' progress'" />
        <span>{{ done() }} / {{ total() }} {{ unit() }}</span>
      </div>
    </header>
    <ng-content />
  `,
  styles: `
    :host { display: grid; gap: 10px; align-content: start; min-width: 0; padding: 16px; background: var(--surface);
      border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
    :host(.is-current) { border-color: color-mix(in srgb, var(--main) 50%, var(--line)); }
    header { display: grid; gap: 6px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
    .title { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    h2 { font-size: 15px; }
    .range { font-size: 12.5px; color: var(--muted); }
    .now { margin-left: auto; align-self: center; }
    .goal { font-size: 13px; color: var(--muted); }
    .progress { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px;
      font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  `,
  host: { '[class.is-current]': 'current()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhaseCardComponent {
  readonly phase = input.required<Phase>();
  readonly done = input(0);
  readonly total = input(0);
  /** What is being counted ("tasks", "steps"). */
  readonly unit = input('done');
  readonly current = input(false, { transform: booleanAttribute });
  protected readonly range = computed(() => phaseRange(this.phase()));
  protected readonly percent = computed(() => (this.total() ? Math.round((this.done() / this.total()) * 100) : 0));
}
