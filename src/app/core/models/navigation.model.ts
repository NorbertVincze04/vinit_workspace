import type { IconName } from '../../shared/ui/icon/icons';

/** A workspace tool, listed in the sidebar and on the overview. */
export interface ToolDefinition {
  id: string;
  title: string;
  /** One short line shown on the overview launcher. */
  description: string;
  icon: IconName;
  route: string;
}

export interface NavLink {
  label: string;
  route: string;
  icon: IconName;
  exact: boolean;
}
