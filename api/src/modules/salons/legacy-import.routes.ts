import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { parseBody } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { today } from '../../lib/dates.js';
import { text } from '../../lib/schemas.js';
import { changeSubscription, createSubscription } from '../billing/billing.service.js';
import { nextPosition } from '../leads/leads.service.js';
import { createSalon } from './salons.service.js';

/**
 * One-time move of the old browser Clients tool (localStorage "clients.v1") to the server
 * (PLAN.md §4):
 *   lead → lead (contacted) · demo → lead (demo booked)
 *   beta → client + salon (trial) + subscription (trialing, Beta, 0 RON)
 *   active → client + salon (active) + subscription (active, its price, since its date)
 *   paused → client + salon (paused) + subscription (paused)
 * The old records never had a business address: those clients are flagged "address missing".
 * Records already moved (by their old id) are skipped, so running it twice is harmless.
 */

const DONE_KEY = 'legacy.clients.imported';

const legacyRecord = z.object({
  id: z.string().min(1).max(64),
  salon: text(200).default(''),
  owner: text(200).default(''),
  city: text(100).default(''),
  phone: text(40).default(''),
  email: text(200).default(''),
  domain: text(253).default(''),
  plan: z.string().max(20).default('standard'),
  /** RON (the old tool stored decimals). */
  price: z.coerce.number().min(0).max(1_000_000).default(0),
  status: z.enum(['lead', 'demo', 'beta', 'active', 'paused']).catch('lead'),
  since: z.string().max(10).default(''),
  notes: text(20_000).default(''),
  createdAt: z.string().max(40).optional(),
});

const importSchema = z.object({ records: z.array(legacyRecord).max(5000) }).strict();

const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const cleanDomain = (v: string): string | null => {
  const d = v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return DOMAIN.test(d) ? d : null;
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isoDay = (v: string): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const isoTime = (v?: string): string | null => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

export function legacyImportRouter(): Router {
  const router = Router();

  router.post('/legacy-clients', async (req, res) => {
    const { records } = parseBody(importSchema, req);
    const userId = req.user?.id;
    const result = await db.transaction(async (trx) => {
      const setting = await trx('appSettings').where({ key: DONE_KEY }).forUpdate().first();
      const done = new Set<string>(Array.isArray(setting?.value) ? setting.value : []);
      const plans = await trx('plans').select('id', 'code');
      const planId = (code: string) => plans.find((p) => p.code === code)?.id ?? plans.find((p) => p.code === 'standard')?.id;
      const beta = await trx('promotions').where({ code: 'beta' }).first('id', 'maxSalons');
      const out = { leads: 0, salons: 0, skipped: 0, needsAddress: 0, notes: [] as string[] };

      for (const r of records) {
        if (done.has(r.id)) {
          out.skipped++;
          continue;
        }
        const name = r.salon.trim() || r.owner.trim() || 'Unnamed salon';
        const email = EMAIL.test(r.email.trim()) ? r.email.trim() : '';
        const extraNotes = [r.notes, email || !r.email.trim() ? '' : `Email (as typed): ${r.email}`].filter(Boolean).join('\n');
        const createdAt = isoTime(r.createdAt);

        if (r.status === 'lead' || r.status === 'demo') {
          const stage = r.status === 'demo' ? 'demo_booked' : 'contacted';
          await trx('leads').insert({
            businessName: name,
            contactName: r.owner,
            city: r.city,
            phone: r.phone,
            email,
            website: r.domain,
            notes: extraNotes,
            source: 'other',
            stage,
            stagePosition: await nextPosition(trx, stage),
            interestedPlanId: planId(r.plan) ?? null,
            ownerUserId: userId ?? null,
            ...(createdAt ? { createdAt } : {}),
          });
          out.leads++;
        } else {
          const [client] = await trx('clients')
            .insert({
              kind: 'company',
              name: r.owner.trim() || name,
              contactPerson: r.owner,
              email,
              phone: r.phone,
              city: r.city,
              businessAddress: null,
              ...(createdAt ? { createdAt } : {}),
            })
            .returning('id');
          out.needsAddress++;

          let domain = cleanDomain(r.domain);
          if (domain && (await trx('salonDomains').where({ domain }).first('id'))) {
            out.notes.push(`${name}: domain ${domain} is already used by another salon, not added`);
            domain = null;
          }
          const since = isoDay(r.since) ?? today();
          const salonId = await createSalon(
            trx,
            {
              name,
              city: r.city,
              planId: planId(r.plan) ?? null,
              notes: extraNotes,
              clientId: client.id,
              status: r.status === 'beta' ? 'trial' : r.status,
              ...(domain ? { domain } : {}),
            },
            userId,
          );
          out.salons++;

          const plan = planId(r.plan);
          if (plan) {
            try {
              // A savepoint: if this fails, the salon above is kept and the import goes on.
              await trx.transaction(async (sp) => {
              if (r.status === 'beta') {
                await createSubscription(sp, salonId, { planId: plan, priceBani: 0, startedOn: since, status: 'trialing', ...(beta ? { promotionId: beta.id } : {}) }, userId);
              } else {
                const subId = await createSubscription(sp, salonId, { planId: plan, priceBani: Math.round(r.price * 100), startedOn: since, status: 'active' }, userId);
                if (r.status === 'paused') await changeSubscription(sp, subId, { kind: 'pause', on: today() < since ? since : today(), note: 'Moved from the old Clients tool' }, userId);
              }
              });
            } catch (e) {
              // e.g. all 5 Beta places taken: keep the salon, note what is missing.
              out.notes.push(`${name}: no subscription created (${(e as Error).message})`);
            }
          }
        }
        done.add(r.id);
      }

      const value = JSON.stringify([...done]);
      if (setting) await trx('appSettings').where({ key: DONE_KEY }).update({ value, updatedBy: userId ?? null });
      else await trx('appSettings').insert({ key: DONE_KEY, value, updatedBy: userId ?? null });
      await logActivity(trx, {
        userId,
        entityType: 'import',
        action: 'legacy_clients',
        summary: `Old Clients moved: ${out.leads} leads, ${out.salons} salons`,
        data: out,
      });
      return out;
    });
    res.json(result);
  });

  return router;
}
