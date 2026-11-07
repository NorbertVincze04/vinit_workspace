import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError } from '../../http/errors.js';
import { parseBody } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { monthKey } from '../../lib/schemas.js';

/**
 * Team-wide settings. Only these keys exist; each has its own validation.
 * (Per-device preferences such as the theme stay in the browser.)
 */
export const SETTINGS = {
  /** Calendar month of plan month 1. */
  'plan.start': monthKey,
  /** RON per EUR / USD, used to convert foreign-currency amounts. */
  'finances.rates': z.object({ eur: z.number().positive().max(100), usd: z.number().positive().max(100) }).strict(),
  /** Roadmap's manual "paying salons" counter (until Phase 2 counts real salons). */
  'roadmap.salons': z.number().int().min(0).max(500),
} as const;

export type SettingKey = keyof typeof SETTINGS;

const isKey = (key: string): key is SettingKey => Object.hasOwn(SETTINGS, key);

export async function writeSetting(
  trx: typeof db,
  key: SettingKey,
  value: unknown,
  userId: string | undefined,
): Promise<unknown> {
  const parsed = SETTINGS[key].parse(value);
  await trx('app_settings')
    .insert({ key, value: JSON.stringify(parsed), updatedBy: userId ?? null })
    .onConflict('key')
    .merge(['value', 'updatedBy']);
  return parsed;
}

export function settingsRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const rows: { key: string; value: unknown }[] = await db('app_settings').select('key', 'value');
    const values: Record<string, unknown> = {};
    for (const r of rows) if (isKey(r.key)) values[r.key] = r.value;
    res.json({ values });
  });

  router.put('/:key', async (req, res) => {
    const key = String(req.params['key']);
    if (!isKey(key)) throw new HttpError(404, 'not_found', `Unknown setting "${key}".`);
    const { value } = parseBody(z.object({ value: z.unknown() }).strict(), req);
    let saved: unknown;
    try {
      saved = await writeSetting(db, key, value, req.user?.id);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HttpError(400, 'validation', 'This value is not valid.', { value: error.issues[0]?.message ?? 'Invalid' });
      }
      throw error;
    }
    await logActivity(db, { userId: req.user?.id, entityType: 'setting', entityId: key, action: 'updated', summary: key });
    res.json({ key, value: saved });
  });

  return router;
}
