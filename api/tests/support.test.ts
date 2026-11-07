import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { APP_HEADER, Agent, AnyRow, createSalon, planId, signedIn } from './helpers.js';

const log = (agent: Agent, body: AnyRow) => agent.post('/api/v1/time-entries').set(APP_HEADER).send(body);

describe('support', () => {
  it('lists the team without secrets', async () => {
    const { agent, user } = await signedIn();
    const users: AnyRow[] = (await agent.get('/api/v1/users')).body.items;
    expect(users).toEqual([{ id: user.id, fullName: user.fullName, email: user.email, role: 'owner' }]);
  });

  it.each(['/tickets', '/time-entries', '/users'])('GET %s needs a session', async (path) => {
    expect((await request(createApp()).get(`/api/v1${path}`)).status).toBe(401);
  });

  it('numbers tickets and stamps resolve / close / reopen', async () => {
    const { agent, user } = await signedIn();
    const s = await createSalon(agent);
    const bad = await agent.post('/api/v1/tickets').set(APP_HEADER).send({ salonId: s.id, title: '', type: 'feature' });
    expect(bad.status).toBe(400);

    const a = await agent.post('/api/v1/tickets').set(APP_HEADER).send({ salonId: s.id, title: 'Booking page shows wrong hours', type: 'bug', priority: 'urgent' });
    const b = await agent.post('/api/v1/tickets').set(APP_HEADER).send({ salonId: s.id, title: 'Add a new barber' });
    expect(a.body.item).toMatchObject({ number: 1, status: 'open', assigneeName: user.fullName, salonName: 'Barber House' });
    expect(b.body.item.number).toBe(2);

    const resolved = await agent.patch(`/api/v1/tickets/${a.body.item.id}`).set(APP_HEADER).send({ status: 'resolved' });
    expect(resolved.body.item.resolvedAt).toBeTruthy();
    const closed = await agent.patch(`/api/v1/tickets/${a.body.item.id}`).set(APP_HEADER).send({ status: 'closed' });
    expect(closed.body.item.closedAt).toBeTruthy();
    const reopened = await agent.patch(`/api/v1/tickets/${a.body.item.id}`).set(APP_HEADER).send({ status: 'open' });
    expect(reopened.body.item).toMatchObject({ resolvedAt: null, closedAt: null });

    const open: AnyRow[] = (await agent.get('/api/v1/tickets?status=open_all')).body.items;
    // Urgent first.
    expect(open.map((t) => t.number)).toEqual([1, 2]);
    expect((await agent.get(`/api/v1/salons/${s.id}`)).body.item.openTickets).toBe(2);
  });

  it('counts included sessions per meeting and refuses one too many', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent, { planId: await planId(agent, 'standard') });
    expect((await log(agent, { salonId: s.id, kind: 'included_session', minutes: 30, description: 'Kickoff' })).status).toBe(201);
    // A long meeting is still one session.
    expect((await log(agent, { salonId: s.id, kind: 'included_session', minutes: 75, description: 'Prototype approval' })).status).toBe(201);
    const third = await log(agent, { salonId: s.id, kind: 'included_session', minutes: 30 });
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe('no_sessions_left');

    const sessions = (await agent.get(`/api/v1/salons/${s.id}/sessions`)).body;
    expect(sessions).toMatchObject({ included: 2, used: 2, remaining: 0, sessionMinutesUsed: 105 });

    const custom = await createSalon(agent, { name: 'Custom salon', planId: await planId(agent, 'custom') });
    expect((await agent.get(`/api/v1/salons/${custom.id}/sessions`)).body).toMatchObject({ included: 3, remaining: 3 });
  });

  it('bills extra work in exact minutes at 100 RON/h and links the entries', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent, { planId: await planId(agent, 'premium') });
    const ticket = (await agent.post('/api/v1/tickets').set(APP_HEADER).send({ salonId: s.id, title: 'New price list', type: 'change_request' })).body.item;
    const e1 = await log(agent, { salonId: s.id, ticketId: ticket.id, kind: 'billable', minutes: 50, workedOn: '2026-11-02' });
    expect(e1.body.item).toMatchObject({ rateBani: 10000, amountBani: 8333, ticketNumber: 1 });
    await log(agent, { salonId: s.id, kind: 'billable', minutes: 7, workedOn: '2026-11-04' });
    await log(agent, { salonId: s.id, kind: 'internal', minutes: 120 });

    expect((await agent.get(`/api/v1/tickets/${ticket.id}`)).body.item.minutesLogged).toBe(50);
    expect((await agent.get(`/api/v1/salons/${s.id}/sessions`)).body).toMatchObject({ unbilledMinutes: 57, unbilledBani: 8333 + 1167, internalMinutes: 120 });

    const billed = await agent.post(`/api/v1/salons/${s.id}/bill-extra-work`).set(APP_HEADER).send({ dueOn: '2026-11-20' });
    expect(billed.status).toBe(201);
    expect(billed.body.item).toMatchObject({ kind: 'extra_work', amountBani: 9500, dueOn: '2026-11-20', periodStart: '2026-11-02', periodEnd: '2026-11-04' });
    expect(billed.body.sessions).toMatchObject({ unbilledMinutes: 0, unbilledBani: 0 });
    expect((await agent.post(`/api/v1/salons/${s.id}/bill-extra-work`).set(APP_HEADER).send({})).status).toBe(409);

    // Billed time is locked; deleting the payment frees it again.
    expect((await agent.patch(`/api/v1/time-entries/${e1.body.item.id}`).set(APP_HEADER).send({ minutes: 60 })).status).toBe(409);
    await agent.delete(`/api/v1/payments/${billed.body.item.id}`).set(APP_HEADER);
    expect((await agent.get(`/api/v1/salons/${s.id}/sessions`)).body.unbilledMinutes).toBe(57);
  });

  it('refuses a ticket from another salon and shows everything on the salon page', async () => {
    const { agent } = await signedIn();
    const a = await createSalon(agent, { name: 'A' });
    const b = await createSalon(agent, { name: 'B' });
    const ticket = (await agent.post('/api/v1/tickets').set(APP_HEADER).send({ salonId: a.id, title: 'Logo too small' })).body.item;
    expect((await log(agent, { salonId: b.id, ticketId: ticket.id, kind: 'internal', minutes: 10 })).status).toBe(400);
    expect((await log(agent, { salonId: a.id, kind: 'internal', minutes: 0 })).status).toBe(400);

    await log(agent, { salonId: a.id, ticketId: ticket.id, kind: 'internal', minutes: 15 });
    const support = (await agent.get(`/api/v1/salons/${a.id}/overview`)).body.support;
    expect(support.tickets.map((t: AnyRow) => t.title)).toEqual(['Logo too small']);
    expect(support.entries).toHaveLength(1);
    expect(support.sessions).toMatchObject({ internalMinutes: 15 });
  });
});
