import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'member';
}

/** The signed-in team member. The session itself is an httpOnly cookie the app never sees. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private checking?: Promise<User | null>;

  readonly user = signal<User | null>(null);

  /** Asks the server who is signed in (once; later calls reuse the answer). */
  check(): Promise<User | null> {
    this.checking ??= this.api
      .get<{ user: User }>('/auth/me')
      .then((res) => {
        this.user.set(res.user);
        return res.user;
      })
      .catch((error: unknown) => {
        // Offline / server down: allow a retry on the next navigation.
        if (!(error instanceof HttpErrorResponse && error.status === 401)) this.checking = undefined;
        this.user.set(null);
        return null;
      });
    return this.checking;
  }

  async login(email: string, password: string): Promise<User> {
    const res = await this.api.write<{ user: User }>('POST', '/auth/login', { email, password });
    this.user.set(res.user);
    this.checking = Promise.resolve(res.user);
    return res.user;
  }

  /** Signs out and reloads, so no team data stays in memory. */
  async logout(): Promise<void> {
    await this.api.write('POST', '/auth/logout').catch(() => undefined);
    location.assign('/login');
  }

  changePassword(currentPassword: string, newPassword: string): Promise<unknown> {
    return this.api.write('POST', '/auth/password', { currentPassword, newPassword });
  }

  /** Called when the server answers 401: start over on the sign-in page. */
  sessionExpired(): void {
    if (location.pathname.startsWith('/login')) return;
    const next = location.pathname + location.search;
    location.assign(`/login?next=${encodeURIComponent(next)}&expired=1`);
  }
}
