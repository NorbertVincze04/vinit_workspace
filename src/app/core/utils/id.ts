/** Short unique id with a readable prefix, e.g. uid('t') → "tlx3k9a2f1q". */
export function uid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
