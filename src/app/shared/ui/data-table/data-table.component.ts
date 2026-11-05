import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TableData } from '../../../core/models';

/**
 * Simple bordered table from plain data; scrolls horizontally on small screens.
 *   <app-data-table [table]="investment" caption="Initial investment" />
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent {
  readonly table = input.required<TableData>();
  readonly caption = input('');

  protected isNumeric(column: number): boolean {
    return this.table().numeric?.includes(column) ?? false;
  }
}
