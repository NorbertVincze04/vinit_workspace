import type { Knex } from 'knex';
import { HttpError, notFound } from '../../http/errors.js';
import { logActivity } from '../../lib/activity.js';
import { salonCreate } from '../salons/salons.schemas.js';
import { createSalon, onSalonStatus } from '../salons/salons.service.js';
import type { LeadStage, leadConvert, leadMove } from './leads.schemas.js';
import type { z } from 'zod';

type Db = Knex | Knex.Transaction;
type Row = Record<string, unknown>;

/** Leads as lists show them: with owner, plan, converted salon and the last contact. */
export function leadRows(k: Db): Knex.QueryBuilder {
  return k('leads as l')
    .leftJoin('users as u', 'u.id', 'l.ownerUserId')
    .leftJoin('plans as p', 'p.id', 'l.interestedPlanId')
    .leftJoin('salons as s', 's.id', 'l.convertedSalonId')
    .select(
      'l.*',
      'u.fullName as ownerName',
      'p.name as interestedPlanName',
      's.name as convertedSalonName',
      's.status as convertedSalonStatus',
      k.raw('(SELECT max(a.occurred_at) FROM lead_activities a WHERE a.lead_id = l.id) as last_activity_at'),
    );
}

export async function getLeadRow(k: Db, id: string): Promise<Row> {
  const row = await leadRows(k).where('l.id', id).first();
  if (!row) throw notFound('Lead');
  return row;
}

async function nextPosition(trx: Db, stage: string): Promise<number> {
  const [{ next }] = await trx('leads').where({ stage }).select(trx.raw('coalesce(max(stage_position), -1) + 1 as next'));
  return Number(next);
}

/** Writes positions 0..n-1 for the given ids, in one statement. */
async function writePositions(trx: Knex.Transaction, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const values = ids.map(() => '(?::uuid, ?::int)').join(', ');
  await trx.raw(
    `UPDATE leads SET stage_position = v.pos FROM (VALUES ${values}) AS v(id, pos) WHERE leads.id = v.id AND leads.stage_position <> v.pos`,
    ids.flatMap((id, i) => [id, i]),
  );
}

async function recordStageChange(
  trx: Knex.Transaction,
  lead: Row,
  to: LeadStage,
  userId: string | null | undefined,
  body = '',
): Promise<void> {
  await trx('leadActivities').insert({ leadId: lead.id, userId: userId ?? null, kind: 'stage_change', fromStage: lead.stage, toStage: to, body });
  await logActivity(trx, {
    userId,
    entityType: 'leads',
    entityId: lead.id as string,
    salonId: (lead.convertedSalonId as string | null) ?? null,
    action: 'stage_changed',
    summary: `${lead.businessName}: ${lead.stage} → ${to}`,
    data: { from: lead.stage, to },
  });
}

/**
 * Moves a lead to a stage and position (kanban drag). Trial and paying are reached by converting the
 * lead; a converted lead follows its salon, so it can only be reordered in its column.
 */
export async function moveLead(
  trx: Knex.Transaction,
  id: string,
  input: z.infer<typeof leadMove>,
  userId?: string | null,
): Promise<void> {
  const lead = await trx('leads').where({ id }).forUpdate().first();
  if (!lead) throw notFound('Lead');
  const { stage } = input;
  const changing = stage !== lead.stage;

  if (changing && lead.convertedSalonId) {
    throw new HttpError(409, 'follows_salon', "This lead is already a salon: change the salon's status instead.");
  }
  if (changing && (stage === 'trial' || stage === 'paying')) {
    throw new HttpError(409, 'convert_first', 'Convert the lead to a salon first (it then follows the salon).');
  }
  const lostReason = stage === 'lost' ? (input.lostReason ?? lead.lostReason) : null;
  if (stage === 'lost' && !lostReason) {
    throw new HttpError(400, 'validation', 'Pick why the lead was lost.', { lostReason: 'Pick why the lead was lost.' });
  }

  const column = (await trx('leads').where({ stage }).whereNot({ id }).orderBy([{ column: 'stagePosition' }, { column: 'createdAt' }]).select('id')).map(
    (r) => r.id as string,
  );
  const at = Math.min(input.position ?? column.length, column.length);
  await trx('leads')
    .where({ id })
    .update({
      stage,
      lostReason,
      ...(stage === 'lost' && input.lostNote !== undefined ? { lostNote: input.lostNote } : {}),
      ...(stage !== 'lost' ? { lostNote: '' } : {}),
    });
  await writePositions(trx, [...column.slice(0, at), id, ...column.slice(at)]);
  if (changing) await recordStageChange(trx, lead, stage, userId, stage === 'lost' ? (input.lostNote ?? '') : '');
}

/** Lead → client + salon. The lead keeps the link and its stage follows the salon from now on. */
export async function convertLead(
  trx: Knex.Transaction,
  id: string,
  input: z.infer<typeof leadConvert>,
  userId?: string | null,
): Promise<string> {
  const lead = await trx('leads').where({ id }).forUpdate().first();
  if (!lead) throw notFound('Lead');
  if (lead.convertedSalonId) throw new HttpError(409, 'already_converted', 'This lead is already a salon.');

  const salonInput = salonCreate.parse({
    name: lead.businessName,
    city: lead.city,
    planId: lead.interestedPlanId ?? undefined,
    referredBySalonId: lead.referredBySalonId ?? undefined,
    ...input.salon,
    status: input.salon?.status ?? 'trial',
    ...(input.client ? { client: input.client } : { clientId: input.clientId }),
  });
  const salonId = await createSalon(trx, salonInput, userId);
  await trx('salons').where({ id: salonId }).update({ leadId: id });

  const stage: LeadStage = salonInput.status === 'active' ? 'paying' : 'trial';
  const salon = await trx('salons').where({ id: salonId }).first('clientId', 'name');
  await trx('leads')
    .where({ id })
    .update({
      convertedClientId: salon.clientId,
      convertedSalonId: salonId,
      convertedAt: trx.fn.now(),
      stage,
      stagePosition: await nextPosition(trx, stage),
      lostReason: null,
    });
  await trx('leadActivities').insert({
    leadId: id,
    userId: userId ?? null,
    kind: 'stage_change',
    fromStage: lead.stage,
    toStage: stage,
    body: `Converted to the salon ${salon.name}`,
  });
  await logActivity(trx, {
    userId,
    entityType: 'leads',
    entityId: id,
    salonId,
    action: 'converted',
    summary: `${lead.businessName} became a salon (${stage})`,
  });
  return salonId;
}

/** Salon status → lead stage, for converted leads (decision A: the stage follows the salon). */
const FOLLOW: Partial<Record<string, LeadStage>> = { trial: 'trial', active: 'paying' };

onSalonStatus(async (trx, salon, to) => {
  const stage = FOLLOW[to];
  if (!stage || !salon.leadId) return;
  const lead = await trx('leads').where({ id: salon.leadId }).forUpdate().first();
  if (!lead || lead.stage === stage) return;
  await trx('leads')
    .where({ id: lead.id })
    .update({ stage, stagePosition: await nextPosition(trx, stage), lostReason: null });
  await recordStageChange(trx, lead, stage, null, `Salon is now ${to}`);
});

export { nextPosition };
