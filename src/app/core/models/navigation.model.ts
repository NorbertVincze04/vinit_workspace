import type { IconName } from '../../shared/ui/icon/icons';

export type ToolStatus = 'live' | 'soon';

/** A workspace tool. Live tools get a route and show up in the header automatically. */
export interface ToolDefinition {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  status: ToolStatus;
  route?: string;
}

export interface NavLink {
  label: string;
  route: string;
  icon: IconName;
  exact: boolean;
}
