/**
 * camelCase ⇄ snake_case for column names. Only the top-level keys of a row are converted,
 * so jsonb values come back exactly as they were stored.
 */
export const toSnake = (s: string): string => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export const toCamel = (s: string): string => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date) && !Buffer.isBuffer(v);

function camelRow(row: unknown): unknown {
  if (!isPlainObject(row)) return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}

/** Knex postProcessResponse: arrays of rows, single rows and raw pg results ({ rows, command }). */
export function camelizeResult(result: unknown): unknown {
  if (Array.isArray(result)) return result.map(camelRow);
  if (isPlainObject(result) && Array.isArray(result['rows']) && 'command' in result) {
    return { ...result, rows: (result['rows'] as unknown[]).map(camelRow) };
  }
  return camelRow(result);
}
