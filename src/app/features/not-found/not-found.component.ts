import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent, IconComponent, PageHeaderComponent } from '../../shared/ui';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, ButtonComponent, IconComponent, PageHeaderComponent],
  templateUrl: './not-found.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
