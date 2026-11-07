import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BackupMenuComponent, PhaseCardComponent, ProgressSummaryComponent } from '../../../shared/components';
import { CheckboxComponent, PageHeaderComponent, PanelComponent } from '../../../shared/ui';
import { SalonCounterComponent } from './components/salon-counter/salon-counter.component';
import { WeeklyRhythmComponent } from './components/weekly-rhythm/weekly-rhythm.component';
import { PLAN_B } from './roadmap.data';
import { RoadmapStore } from './roadmap.store';

/** Roadmap tool: four phase checklists, the salon counter and the weekly rhythm. */
@Component({
  selector: 'app-roadmap-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    PanelComponent,
    CheckboxComponent,
    ProgressSummaryComponent,
    PhaseCardComponent,
    BackupMenuComponent,
    SalonCounterComponent,
    WeeklyRhythmComponent,
  ],
  templateUrl: './roadmap-page.component.html',
  styleUrl: './roadmap-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoadmapPageComponent {
  protected readonly store = inject(RoadmapStore);
  protected readonly planB = PLAN_B;
}
