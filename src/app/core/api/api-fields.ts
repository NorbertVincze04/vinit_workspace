/**
 * How one field of an app model maps to the API: its name there and how the value converts.
 * The app keeps its existing models (RON as decimals, '' for "no date"); the API uses
 * integer bani and null. Each store describes its fields once with these helpers.
 */
export interface FieldCodec {
  /** Field name in the API (defaults to the app's name). */
  api?: string;
  toApi(value: unknown): unknown;
  fromApi(value: unknown): unknown;
}

export type FieldMap<T> = { [K in keyof T]?: FieldCodec };

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const field = {
  text: (api?: string): FieldCodec => ({ api, toApi: str, fromApi: str }),
  number: (api?: string): FieldCodec => ({ api, toApi: num, fromApi: num }),
  int: (api?: string): FieldCodec => ({ api, toApi: (v) => Math.round(num(v)), fromApi: num }),
  bool: (api?: string): FieldCodec => ({ api, toApi: (v) => v === true || v === 'true', fromApi: (v) => v === true }),
  /** RON with decimals in the app ⇄ whole bani in the API (12,34 RON ⇄ 1234). */
  money: (api: string): FieldCodec => ({
    api,
    toApi: (v) => Math.round(num(v) * 100),
    fromApi: (v) => num(v) / 100,
  }),
  /** "YYYY-MM-DD" or '' in the app ⇄ date or null in the API. */
  date: (api?: string): FieldCodec => ({ api, toApi: (v) => (v ? String(v) : null), fromApi: str }),
  /** Link to another record: '' in the app ⇄ null in the API. */
  ref: (api?: string): FieldCodec => ({ api, toApi: (v) => (v ? String(v) : null), fromApi: str }),
  list: (api?: string): FieldCodec => ({
    api,
    toApi: (v) => (Array.isArray(v) ? v.map(String) : []),
    fromApi: (v) => (Array.isArray(v) ? v.map(String) : []),
  }),
};

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** App object (or partial patch) → API body. Unknown keys are dropped. */
export function toApi<T>(fields: FieldMap<T>, source: Partial<T>, options: { meta?: boolean } = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const src = source as Record<string, unknown>;
  for (const key of Object.keys(fields) as (keyof T & string)[]) {
    if (!(key in src) || src[key] === undefined) continue;
    const codec = fields[key]!;
    out[codec.api ?? key] = codec.toApi(src[key]);
  }
  if (options.meta) {
    if (typeof src['id'] === 'string') out['id'] = src['id'];
    for (const k of ['createdAt', 'updatedAt']) if (typeof src[k] === 'string' && ISO.test(src[k] as string)) out[k] = src[k];
  }
  return out;
}

/** API row → app object (with id, createdAt and updatedAt). */
export function fromApi<T>(fields: FieldMap<T>, row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {
    id: String(row['id']),
    createdAt: str(row['createdAt']),
    updatedAt: str(row['updatedAt']),
  };
  for (const key of Object.keys(fields)) {
    const codec = (fields as Record<string, FieldCodec>)[key];
    out[key] = codec.fromApi(row[codec.api ?? key]);
  }
  return out as T;
}
