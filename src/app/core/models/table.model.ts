/** Plain text table rendered by <app-data-table>. The first cell of each row is the row header. */
export interface TableData {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  /** Optional totals row. */
  footer?: readonly string[];
  /** Column indexes to right-align (numbers). */
  numeric?: readonly number[];
}
