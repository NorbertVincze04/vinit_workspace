import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError } from '../../http/errors.js';
import { parseBody } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { clearSessionCookie, requireAuth, setSessionCookie } from './auth.middleware.js';
import { checkPassword, emailSchema, findUserById, passwordSchema, setPassword, toPublic, verifyCredentials } from './auth.service.js';

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password.').max(200) });
const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema });

const ONE_DAY_S = 24 * 60 * 60;

export function authRouter(): Router {
  const router = Router();

  // 10 failed attempts per 15 minutes per IP; successful sign-ins don't count.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'rate_limited', message: 'Too many attempts. Try again in 15 minutes.' } });
    },
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = parseBody(loginSchema, req);
    const user = await verifyCredentials(email, password);
    if (!user) throw new HttpError(401, 'invalid_credentials', 'Wrong email or password.');
    await db('users').where({ id: user.id }).update({ lastLoginAt: db.fn.now() });
    setSessionCookie(res, user);
    res.json({ user: toPublic(user) });
  });

  router.post('/logout', (_req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.get('/me', requireAuth, async (req, res) => {
    // Sliding session: re-issue the cookie once a day while the app is in use.
    if ((req.sessionIssuedAt ?? 0) < Date.now() / 1000 - ONE_DAY_S) {
      const user = await findUserById(req.user!.id);
      if (user) setSessionCookie(res, user);
    }
    res.json({ user: req.user });
  });

  router.post('/password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = parseBody(passwordChangeSchema, req);
    const user = await findUserById(req.user!.id);
    if (!user || !(await checkPassword(user, currentPassword))) {
      throw new HttpError(400, 'validation', 'The current password is wrong.', { currentPassword: 'Wrong password.' });
    }
    const updated = await setPassword(user.id, newPassword);
    // Other devices are signed out (token_version changed); this one gets a fresh cookie.
    setSessionCookie(res, updated);
    await logActivity(db, { userId: user.id, entityType: 'user', entityId: user.id, action: 'password_changed' });
    res.status(204).end();
  });

  return router;
}
