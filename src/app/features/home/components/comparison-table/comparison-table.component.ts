import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComparisonTable } from '../../../../core/models';
import { IconComponent } from '../../../../shared/ui';

/** Feature matrix: traits as rows, products as columns, ✓ / ✗ cells. The first column is "us". */
@Component({
  selector: 'app-comparison-table',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './comparison-table.component.html',
  styleUrl: './comparison-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparisonTableComponent {
  readonly table = input.required<ComparisonTable>();
  readonly caption = input('');
}
