import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { phaseRange } from '../../../core/data/phases.data';
import { Phase } from '../../../core/models';
import { BadgeComponent, CardComponent } from '../../ui';

/**
 * Card shell for one Year-1 phase: range, "You are here", name, goal and a count line.
 * The list inside is projected, so Roadmap and Tasks each render their own items.
 *   <app-phase-card [phase]="phase" count="2 of 6 steps" [current]="true"> <ul>…</ul> </app-phase-card>
 */
@Component({
  selector: 'app-phase-card',
  standalone: true,
  imports: [CardComponent, BadgeComponent],
  template: `
    <app-card [highlight]="current()">
      <div class="head">
        <span class="eyebrow">{{ range() }}</span>
        @if (current()) {
          <app-badge variant="solid">You are here</app-badge>
        }
      </div>
      <h2 class="title-md">{{ phase().name }}</h2>
      <p class="muted">{{ phase().goal }}</p>
      @if (count()) {
        <span class="count">{{ count() }}</span>
      }
      <ng-content />
    </app-card>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    app-card { --card-gap: 10px; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 22px; }
    h2 { font-size: 34px; }
    .count { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhaseCardComponent {
  readonly phase = input.required<Phase>();
  readonly count = input('');
  readonly current = input(false, { transform: booleanAttribute });

  protected readonly range = computed(() => phaseRange(this.phase()));
}
