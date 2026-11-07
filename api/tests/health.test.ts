import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { signedIn } from './helpers.js';

describe('health', () => {
  it('reports the API and database as up', async () => {
    const res = await request(createApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('hides unknown endpoints from anonymous callers (401) and 404s them for signed-in users', async () => {
    expect((await request(createApp()).get('/api/v1/nope')).status).toBe(401);
    const { agent } = await signedIn();
    const res = await agent.get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
