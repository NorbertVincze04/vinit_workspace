import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { HttpError, notFound } from '../http/errors.js';
import { parseBody } from '../http/validate.js';
import { uuid } from '../lib/schemas.js';
import { checkSites, integrationsStatus, invoiceProvider } from './integrations.js';

/** /integrations — status of the outside services, the uptime check, the invoice seam. */
export function integrationsRouter(): Router {
  const router = Router();

  router.get('/status', (_req, res) => {
    res.json({ items: integrationsStatus() });
  });

  /** Checks the primary domain of every trial / active salon, now. */
  router.post('/uptime/check', async (_req, res) => {
    const salons = await db('salons as s')
      .join('salonDomains as d', function () {
        this.on('d.salonId', '=', 's.id').andOnVal('d.isPrimary', '=', true);
      })
      .whereIn('s.status', ['trial', 'active'])
      .orderBy('s.name')
      .limit(200)
      .select('s.id', 's.name', 'd.domain');
    const results = await checkSites(salons.map((s) => `https://${s.domain}`));
    res.json({
      checkedAt: new Date().toISOString(),
      items: salons.map((s, i) => ({ salonId: s.id, salonName: s.name, domain: s.domain, ...results[i] })),
    });
  });

  /** Issues the invoice for a paid payment through the configured provider. */
  router.post('/invoices', async (req, res) => {
    const { paymentId } = parseBody(z.object({ paymentId: uuid }), req);
    const provider = invoiceProvider();
    if (!provider) throw new HttpError(409, 'not_configured', 'No invoice provider is configured. Set INVOICE_PROVIDER and its variables in .env.');
    const p = await db('payments as p')
      .join('salons as s', 's.id', 'p.salonId')
      .join('clients as c', 'c.id', 's.clientId')
      .where('p.id', paymentId)
      .first('p.id', 'p.amountBani', 'p.paidOn', 'p.status', 's.name as salonName', 'c.name as clientName', 'c.businessAddress as clientAddress');
    if (!p) throw notFound('Payment');
    if (p.status !== 'paid') throw new HttpError(409, 'not_paid', 'Mark the payment paid before invoicing it.');
    const invoice = await provider.createInvoice({
      paymentId: p.id,
      clientName: p.clientName,
      clientAddress: p.clientAddress ?? '',
      salonName: p.salonName,
      amountBani: p.amountBani,
      issuedOn: p.paidOn,
      description: `VINIT booking site subscription · ${p.salonName}`,
    });
    res.status(201).json({ invoice });
  });

  return router;
}
