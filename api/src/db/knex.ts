import knexFactory, { Knex } from 'knex';
import pg from 'pg';
import { config } from '../config.js';
import { camelizeResult, toSnake } from './case.js';

// DATE columns stay "YYYY-MM-DD" strings: no JS Date, so no timezone shift around midnight.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
// bigint (counts, sums) and numeric as JS numbers; our values are far below 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));

export function createKnex(overrides: Partial<Knex.Config> = {}): Knex {
  return knexFactory({
    client: 'pg',
    connection: { ...config.db },
    pool: { min: 0, max: 10 },
    // JS code uses camelCase, the database snake_case.
    wrapIdentifier: (value, origImpl) => origImpl(value === '*' ? value : toSnake(value)),
    postProcessResponse: (result) => camelizeResult(result),
    ...overrides,
  });
}

/** The shared connection pool. */
export const db = createKnex();
