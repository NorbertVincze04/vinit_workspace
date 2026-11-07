import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/knex.js';
import { addDays, today } from '../src/lib/dates.js';
import { generateNotifications } from '../src/modules/notifications/notifications.service.js';
import { APP_HEADER, AnyRow, PASSWORD, createSalon, makeUser, planId, signedIn } from './helpers.js';

describe('notifications', () => {
  it('needs a session', async () => {
    expect((await request(createApp()).get('/api/v1/notifications/count')).status).toBe(401);
  });

  it('are generated once per event, for everyone or for the person concerned', async () => {
    const { agent, app, user } = await signedIn();
    const colleague = await makeUser('sales@vinit.test', 'Sales Person');

    // Everyone: an overdue payment.
    const s = await createSalon(agent, { name: 'Barber House' });
    await agent.post(`/api/v1/salons/${s.id}/subscriptions`).set(APP_HEADER).send({ planId: await planId(agent, 'standard') });
    await agent.post('/api/v1/payments').set(APP_HEADER).send({ salonId: s.id, amountBani: 15000, dueOn: addDays(today(), -3) });
    // Only the colleague: their lead's follow-up.
    await agent.post('/api/v1/leads').set(APP_HEADER).send({ businessName: 'Fade Factory', nextFollowUpOn: today(), ownerUserId: colleague.id });
    // Deadlines 3 days away: a 1-week reminder has passed, a 1-hour one hasn't.
    await agent.post('/api/v1/deadlines').set(APP_HEADER).send({ title: 'VAT return', dueOn: addDays(today(), 3), reminders: [10080] });
    await agent.post('/api/v1/deadlines').set(APP_HEADER).send({ title: 'Bank meeting', dueOn: addDays(today(), 3), dueTime: '10:00', reminders: [10080, 60] });
    await agent.post('/api/v1/deadlines').set(APP_HEADER).send({ title: 'Not yet', dueOn: addDays(today(), 3), dueTime: '10:00', reminders: [60] });

    const created = await generateNotifications(db);
    expect(await generateNotifications(db)).toBe(0);
    expect(created).toBeGreaterThan(0);

    const mine: AnyRow[] = (await agent.get('/api/v1/notifications')).body.items;
    const kinds = mine.map((n) => n.kind);
    expect(kinds).toEqual(expect.arrayContaining(['payment_overdue', 'deadline', 'backup']));
    expect(kinds).not.toContain('lead_followup');
    const overdue = mine.find((n) => n.kind === 'payment_overdue')!;
    expect(overdue).toMatchObject({ severity: 'bad', link: `/tools/salons/${s.id}?tab=billing`, salonName: 'Barber House', readAt: null });
    expect(mine.find((n) => n.title === 'VAT return')).toMatchObject({ kind: 'deadline', body: `Due in 3 days (${addDays(today(), 3)})` });
    expect(mine.find((n) => n.title === 'Bank meeting')!.body).toBe(`Due in 3 days (${addDays(today(), 3)} at 10:00)`);
    expect(mine.map((n) => n.title)).not.toContain('Not yet');

    const other = request.agent(app);
    await other.post('/api/v1/auth/login').set(APP_HEADER).send({ email: 'sales@vinit.test', password: PASSWORD });
    const theirs: AnyRow[] = (await other.get('/api/v1/notifications')).body.items;
    expect(theirs.map((n) => n.kind)).toContain('lead_followup');
    expect(theirs.find((n) => n.kind === 'lead_followup')!.title).toBe('Follow up Fade Factory');
    expect(user.id).not.toBe(colleague.id);
  });

  it('can be read, all read, dismissed, and only by their owner', async () => {
    const { agent, app } = await signedIn();
    await makeUser('second@vinit.test', 'Second');
    await generateNotifications(db); // at least the backup nudge for each person
    const count = (await agent.get('/api/v1/notifications/count')).body.unread;
    expect(count).toBeGreaterThan(0);

    const [first] = (await agent.get('/api/v1/notifications')).body.items;
    expect((await agent.post(`/api/v1/notifications/${first.id}/read`).set(APP_HEADER)).status).toBe(204);
    expect((await agent.get('/api/v1/notifications/count')).body.unread).toBe(count - 1);

    const second = request.agent(app);
    await second.post('/api/v1/auth/login').set(APP_HEADER).send({ email: 'second@vinit.test', password: PASSWORD });
    expect((await second.post(`/api/v1/notifications/${first.id}/dismiss`).set(APP_HEADER)).status).toBe(404);

    await agent.post(`/api/v1/notifications/${first.id}/dismiss`).set(APP_HEADER);
    expect((await agent.get('/api/v1/notifications')).body.items.map((n: AnyRow) => n.id)).not.toContain(first.id);
    await agent.post('/api/v1/notifications/read-all').set(APP_HEADER);
    expect((await agent.get('/api/v1/notifications/count')).body.unread).toBe(0);
    // The dismissed one doesn't come back when the job runs again.
    await generateNotifications(db);
    expect((await agent.get('/api/v1/notifications')).body.items.map((n: AnyRow) => n.id)).not.toContain(first.id);
  });
});
