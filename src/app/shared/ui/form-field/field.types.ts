/** How a field shows its label: above the control, beside it, or only to screen readers. */
export type FieldLabelMode = 'stacked' | 'inline' | 'hidden';

export interface SelectOption {
  value: string;
  label: string;
}
