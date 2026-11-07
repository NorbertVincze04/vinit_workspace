import type { CookieOptions, RequestHandler, Response } from 'express';
import { config } from '../../config.js';
import { HttpError } from '../../http/errors.js';
import { PublicUser, findUserById, readSession, signSession, toPublic } from './auth.service.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      user?: PublicUser;
      /** Seconds since epoch when the session token was issued. */
      sessionIssuedAt?: number;
    }
  }
}

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.cookieSecure,
  path: '/api',
  maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
});

export function setSessionCookie(res: Response, user: { id: string; tokenVersion: number }): void {
  res.cookie(config.cookieName, signSession(user), cookieOptions());
}

export function clearSessionCookie(res: Response): void {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(config.cookieName, options);
}

/** Rejects requests without a valid session cookie (401). */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[config.cookieName];
  const claims = typeof token === 'string' ? readSession(token) : null;
  const user = claims ? await findUserById(claims.sub) : undefined;
  if (!claims || !user || !user.isActive || user.tokenVersion !== claims.tv) {
    throw new HttpError(401, 'unauthenticated', 'Please sign in.');
  }
  req.user = toPublic(user);
  req.sessionIssuedAt = claims.iat;
  next();
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth (on top of SameSite=Lax): every write must carry the
 * X-Requested-With header, which a cross-site form or image cannot send.
 */
export const requireAppHeader: RequestHandler = (req, _res, next) => {
  if (!SAFE_METHODS.has(req.method) && !req.get('X-Requested-With')) {
    throw new HttpError(403, 'missing_header', 'Requests must come from the VINIT app.');
  }
  next();
};
