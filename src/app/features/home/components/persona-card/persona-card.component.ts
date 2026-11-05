import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Persona } from '../../../../core/models';
import { BadgeComponent, CardComponent } from '../../../../shared/ui';

/** The ideal-customer persona. */
@Component({
  selector: 'app-persona-card',
  standalone: true,
  imports: [CardComponent, BadgeComponent],
  template: `
    <app-card padding="lg">
      <app-badge variant="second">Ideal customer</app-badge>
      <div class="who">
        <span class="avatar" aria-hidden="true">{{ initials() }}</span>
        <div>
          <h3 class="title-sm">{{ persona().name }}, {{ persona().age }}</h3>
          <p class="muted small">{{ persona().role }}</p>
        </div>
      </div>
      <p>{{ persona().lifestyle }}</p>
      <blockquote>{{ persona().problem }}</blockquote>
    </app-card>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    app-badge { justify-self: start; }
    .who { display: flex; gap: 14px; align-items: center; }
    .avatar { width: 52px; height: 52px; flex: none; display: grid; place-items: center; border-radius: 50%;
      background: var(--second); color: var(--on-second); font-family: var(--font-display); font-weight: 700; font-size: 22px; }
    blockquote { margin: 0; padding: 12px 14px; border-left: 3px solid var(--main);
      background: var(--main-soft); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonaCardComponent {
  readonly persona = input.required<Persona>();

  protected readonly initials = computed(() =>
    this.persona()
      .name.split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2),
  );
}
