import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TOOLS } from '../../../../core/data/tools.data';
import { ToolCardComponent } from '../../../../shared/components';
import { GridComponent, SectionComponent } from '../../../../shared/ui';

/** Launcher for every workspace tool (live and planned). Anchor: #tools */
@Component({
  selector: 'app-tools-section',
  standalone: true,
  imports: [SectionComponent, GridComponent, ToolCardComponent],
  template: `
    <app-section
      id="tools"
      eyebrow="Workspace"
      title="Tools"
      lede="Each tool saves its data in this browser. Use Export backup inside a tool to keep a copy or move it to another device.">
      <app-grid min="230px" align="stretch">
        @for (tool of tools; track tool.id) {
          <app-tool-card [tool]="tool" />
        }
      </app-grid>
    </app-section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolsSectionComponent {
  protected readonly tools = TOOLS;
}
