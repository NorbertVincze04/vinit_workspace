import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_BASE } from './api.service';

/** Endpoints where a 401 is an expected answer, not an expired session. */
const AUTH_PROBES = [`${API_BASE}/auth/login`, `${API_BASE}/auth/me`];

/**
 * Adds the header the API requires on writes (CSRF defence) and sends the user to the sign-in
 * page when their session has expired.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE)) return next(req);
  const auth = inject(AuthService);
  return next(req.clone({ setHeaders: { 'X-Requested-With': 'vinit-web' } })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !AUTH_PROBES.includes(req.url)) {
        auth.sessionExpired();
      }
      return throwError(() => error);
    }),
  );
};
