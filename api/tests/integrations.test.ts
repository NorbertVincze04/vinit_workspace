import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { checkSite, checkSites } from '../src/integrations/integrations.js';
import { APP_HEADER, AnyRow, createSalon, signedIn } from './helpers.js';

const VARS = ['INVOICE_PROVIDER', 'SMARTBILL_EMAIL', 'SMARTBILL_TOKEN', 'SMARTBILL_CIF', 'SMARTBILL_SERIES', 'UPTIMEROBOT_API_KEY'];

describe('integrations', () => {
  let server: Server;
  let base = '';
  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/slow') return void setTimeout(() => res.end('late'), 2000);
      res.statusCode = req.url === '/down' ? 503 : 200;
      res.end('ok');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  afterEach(() => VARS.forEach((v) => delete process.env[v]));

  it('need a session', async () => {
    expect((await request(createApp()).get('/api/v1/integrations/status')).status).toBe(401);
  });

  it('report what is configured by variable name, never the values', async () => {
    const { agent } = await signedIn();
    const status = async (): Promise<Record<string, AnyRow>> =>
      Object.fromEntries((await agent.get('/api/v1/integrations/status')).body.items.map((i: AnyRow) => [i.id, i]));

    let s = await status();
    expect(s.smartbill).toMatchObject({ state: 'not_configured', missing: expect.arrayContaining(['INVOICE_PROVIDER', 'SMARTBILL_TOKEN']) });
    expect(s.uptime.state).toBe('built_in');
    expect(s.uptimerobot.missing).toEqual(['UPTIMEROBOT_API_KEY']);

    Object.assign(process.env, { INVOICE_PROVIDER: 'smartbill', SMARTBILL_EMAIL: 'a@b.ro', SMARTBILL_TOKEN: 'secret-token-123', SMARTBILL_CIF: 'RO1', SMARTBILL_SERIES: 'VIN', UPTIMEROBOT_API_KEY: 'u-secret' });
    const raw = (await agent.get('/api/v1/integrations/status')).text;
    expect(raw).not.toContain('secret-token-123');
    expect(raw).not.toContain('u-secret');
    s = await status();
    expect(s.smartbill).toMatchObject({ state: 'configured_not_built', missing: [] });
    expect(s.oblio.state).toBe('not_configured');
    expect(s.uptimerobot.state).toBe('configured_not_built');
  });

  it('invoice through the configured provider (a stub for now)', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent, { name: 'Barber House' });
    const pay = (await agent.post('/api/v1/payments').set(APP_HEADER).send({ salonId: s.id, amountBani: 15000, dueOn: '2026-11-01' })).body.item;
    const invoice = () => agent.post('/api/v1/integrations/invoices').set(APP_HEADER).send({ paymentId: pay.id });

    expect((await invoice()).body.error.code).toBe('not_configured');
    Object.assign(process.env, { INVOICE_PROVIDER: 'smartbill', SMARTBILL_EMAIL: 'a@b.ro', SMARTBILL_TOKEN: 't', SMARTBILL_CIF: 'RO1', SMARTBILL_SERIES: 'VIN' });
    expect((await invoice()).body.error.code).toBe('not_paid');
    await agent.post(`/api/v1/payments/${pay.id}/mark-paid`).set(APP_HEADER).send({ paidOn: '2026-11-02' });
    const res = await invoice();
    expect(res.status).toBe(501);
    expect(res.body.error.message).toContain('SmartBill');
  });

  it('checks sites: up, down, too slow, no such host', async () => {
    expect(await checkSite(`${base}/ok`)).toMatchObject({ ok: true, status: 200 });
    expect(await checkSite(`${base}/down`)).toMatchObject({ ok: false, status: 503 });
    expect(await checkSite(`${base}/slow`, 300)).toMatchObject({ ok: false, status: null, error: 'No answer in 0s' });
    const all = await checkSites([`${base}/ok`, `${base}/down`, 'https://nothing-here.invalid']);
    expect(all.map((r) => r.ok)).toEqual([true, false, false]);
    expect(all[2].error).toMatch(/DNS/);
  }, 20_000);

  it('checks only live salons with a domain', async () => {
    const { agent } = await signedIn();
    await createSalon(agent, { name: 'No Domain' });
    const res = await agent.post('/api/v1/integrations/uptime/check').set(APP_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});
