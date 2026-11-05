import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COMPANY } from '../../core/data/business.data';
import { LIVE_TOOLS } from '../../core/data/tools.data';
import { IconComponent, LogoComponent } from '../../shared/ui';

/** Site footer: brand, company facts, workspace links and the public website. */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, IconComponent, LogoComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  protected readonly company = COMPANY;
  protected readonly tools = LIVE_TOOLS;
  protected readonly year = new Date().getFullYear();
}
