import { ChangeDetectionStrategy, Component } from '@angular/core';
import { COMPANY } from '../../core/data/business.data';
import { PageHeaderComponent } from '../../shared/ui';
import { SectionLink, SectionNavComponent } from './components/section-nav/section-nav.component';
import { CompanySectionComponent } from './sections/company/company-section.component';
import { CompetitionSectionComponent } from './sections/competition/competition-section.component';
import { FinancesSectionComponent } from './sections/finances/finances-section.component';
import { MarketSectionComponent } from './sections/market/market-section.component';
import { OfferSectionComponent } from './sections/offer/offer-section.component';
import { PlanSectionComponent } from './sections/plan/plan-section.component';
import { RisksSectionComponent } from './sections/risks/risks-section.component';
import { StatusSectionComponent } from './sections/status/status-section.component';
import { SustainabilitySectionComponent } from './sections/sustainability/sustainability-section.component';
import { ToolsSectionComponent } from './sections/tools/tools-section.component';

/**
 * Internal overview: tools, live status and business-plan reference, one section component per topic.
 * Reorder, remove or add sections in home.component.html (and the jump links below).
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    PageHeaderComponent,
    SectionNavComponent,
    ToolsSectionComponent,
    StatusSectionComponent,
    PlanSectionComponent,
    FinancesSectionComponent,
    CompanySectionComponent,
    OfferSectionComponent,
    MarketSectionComponent,
    CompetitionSectionComponent,
    RisksSectionComponent,
    SustainabilitySectionComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  protected readonly company = COMPANY;

  protected readonly sections: readonly SectionLink[] = [
    { id: 'tools', label: 'Tools' },
    { id: 'status', label: 'Status' },
    { id: 'plan', label: 'Goals & plan' },
    { id: 'finances', label: 'Finances' },
    { id: 'company', label: 'Company & team' },
    { id: 'offer', label: 'Product & pricing' },
    { id: 'market', label: 'Market' },
    { id: 'competition', label: 'Competition' },
    { id: 'risks', label: 'Risks' },
    { id: 'sustainability', label: 'Sustainability' },
  ];
}
