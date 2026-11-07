import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createUser } from '../src/modules/auth/auth.service.js';
import { APP_HEADER, PASSWORD, makeUser, signedIn } from './helpers.js';

describe('auth', () => {
  it('signs in with the right password and sets an httpOnly cookie', async () => {
    await makeUser();
    const res = await request(createApp())
      .post('/api/v1/auth/login')
      .set(APP_HEADER)
      .send({ email: 'Owner@Vinit.test', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'owner@vinit.test', fullName: 'Test Owner', role: 'owner' });
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('vinit_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('rejects a wrong password and an unknown email the same way', async () => {
    await makeUser();
    const app = createApp();
    const wrong = await request(app).post('/api/v1/auth/login').set(APP_HEADER).send({ email: 'owner@vinit.test', password: 'nope-nope-nope' });
    const unknown = await request(app).post('/api/v1/auth/login').set(APP_HEADER).send({ email: 'who@vinit.test', password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe('invalid_credentials');
    expect(unknown.body.error.code).toBe('invalid_credentials');
  });

  it('validates the login body', async () => {
    const res = await request(createApp()).post('/api/v1/auth/login').set(APP_HEADER).send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('requires the app header on writes', async () => {
    const res = await request(createApp()).post('/api/v1/auth/login').send({ email: 'owner@vinit.test', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('missing_header');
  });

  it('returns the current user, and 401 without a session', async () => {
    const { agent } = await signedIn();
    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('owner@vinit.test');

    const anonymous = await request(createApp()).get('/api/v1/auth/me');
    expect(anonymous.status).toBe(401);
  });

  it('signs out', async () => {
    const { agent } = await signedIn();
    expect((await agent.post('/api/v1/auth/logout').set(APP_HEADER)).status).toBe(204);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('changes the password and signs out other sessions', async () => {
    const { app, agent } = await signedIn();
    const other = request.agent(app);
    await other.post('/api/v1/auth/login').set(APP_HEADER).send({ email: 'owner@vinit.test', password: PASSWORD });

    const bad = await agent.post('/api/v1/auth/password').set(APP_HEADER).send({ currentPassword: 'wrong', newPassword: 'another-long-password' });
    expect(bad.status).toBe(400);

    const ok = await agent.post('/api/v1/auth/password').set(APP_HEADER).send({ currentPassword: PASSWORD, newPassword: 'another-long-password' });
    expect(ok.status).toBe(204);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
    expect((await other.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('allows at most 3 active users and makes the first one the owner', async () => {
    const first = await createUser({ email: 'a@vinit.test', fullName: 'A', password: PASSWORD });
    const second = await createUser({ email: 'b@vinit.test', fullName: 'B', password: PASSWORD });
    await createUser({ email: 'c@vinit.test', fullName: 'C', password: PASSWORD });
    expect(first.role).toBe('owner');
    expect(second.role).toBe('member');
    await expect(createUser({ email: 'd@vinit.test', fullName: 'D', password: PASSWORD })).rejects.toMatchObject({ code: 'user_limit' });
  });

  it('rate-limits repeated failed sign-ins', async () => {
    const app = createApp();
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await request(app).post('/api/v1/auth/login').set(APP_HEADER).send({ email: 'x@vinit.test', password: 'wrong-password' })).status;
    }
    expect(last).toBe(429);
  });
});
