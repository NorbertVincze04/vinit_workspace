import type { Knex } from 'knex';
import { HttpError, notFound } from '../../http/errors.js';
import { logActivity } from '../../lib/activity.js';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface StartInput {
  signedAt?: string;
  materialsReceivedAt?: string | null;
  notes?: string;
}

/**
 * Starts a salon's onboarding with the template's checklist and stamps the salon as signed.
 * Used by POST /salons/:id/onboarding and when a subscription contract is signed. Returns its id.
 */
export async function startOnboarding(trx: Knex.Transaction, salonId: string, input: StartInput, userId?: string | null): Promise<string> {
  const salon = await trx('salons').where({ id: salonId }).forUpdate().first();
  if (!salon) throw notFound('Salon');
  if (await trx('onboardings').where({ salonId }).first('id')) throw new HttpError(409, 'conflict', 'This salon already has an onboarding.');
  const signedAt = input.signedAt ?? salon.signedAt ?? new Date().toISOString();
  const [row] = await trx('onboardings')
    .insert({ salonId, signedAt, materialsReceivedAt: input.materialsReceivedAt ?? null, notes: input.notes ?? '' })
    .returning('*');
  const template = await trx('onboardingTemplateItems').orderBy('position');
  if (template.length) {
    await trx('onboardingSteps').insert(
      template.map((t: Row, i: number) => ({ onboardingId: row.id, position: i, title: t.title, description: t.description, category: t.category })),
    );
  }
  if (!salon.signedAt) await trx('salons').where({ id: salonId }).update({ signedAt });
  await logActivity(trx, { userId, entityType: 'onboardings', entityId: row.id, salonId, action: 'created', summary: `${salon.name}: onboarding started` });
  return row.id as string;
}
