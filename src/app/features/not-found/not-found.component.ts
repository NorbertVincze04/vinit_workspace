import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent, EmptyStateComponent } from '../../shared/ui';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, ButtonComponent, EmptyStateComponent],
  templateUrl: './not-found.component.html',
  styles: ':host { display: block; margin-top: 48px; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
