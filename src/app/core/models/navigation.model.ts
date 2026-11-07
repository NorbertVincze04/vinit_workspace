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

/** Tools that belong together (one role works mostly in one group). */
export interface ToolGroup {
  id: string;
  title: string;
  /** What the group is for, shown on the overview. */
  who: string;
  tools: readonly ToolDefinition[];
}

export interface NavLink {
  label: string;
  route: string;
  icon: IconName;
  exact: boolean;
}
