import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { AuthService } from '../auth/auth.service';

export interface AppNotification {
  id: string;
  kind: string;
  severity: 'info' | 'warn' | 'bad';
  title: string;
  body: string;
  /** In-app link, may carry a query (?tab=billing). */
  link: string;
  salonName: string | null;
  dueOn: string | null;
  readAt: string | null;
  createdAt: string;
}

const POLL_MS = 2 * 60 * 1000;

/** The signed-in person's notifications: unread count (polled), the list, read / dismiss. */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly unread = signal(0);
  readonly items = signal<AppNotification[]>([]);
  readonly loading = signal(false);

  constructor() {
    let timer: ReturnType<typeof setInterval> | undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && this.auth.user()) void this.refreshCount();
    };
    // Poll only while someone is signed in.
    effect(() => {
      clearInterval(timer);
      if (!this.auth.user()) return;
      void this.refreshCount();
      timer = setInterval(() => void this.refreshCount(), POLL_MS);
    });
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  async refreshCount(): Promise<void> {
    try {
      this.unread.set((await this.api.get<{ unread: number }>('/notifications/count')).unread);
    } catch {
      /* offline or signed out: keep the last count */
    }
  }

  /** The list (the server brings it up to date first). */
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.items.set((await this.api.get<{ items: AppNotification[] }>('/notifications')).items);
      await this.refreshCount();
    } catch {
      /* the panel shows what it has */
    } finally {
      this.loading.set(false);
    }
  }

  async read(n: AppNotification): Promise<void> {
    if (n.readAt) return;
    this.items.update((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    this.unread.update((c) => Math.max(0, c - 1));
    await this.api.write('POST', `/notifications/${n.id}/read`).catch(() => undefined);
  }

  async dismiss(n: AppNotification): Promise<void> {
    this.items.update((list) => list.filter((x) => x.id !== n.id));
    if (!n.readAt) this.unread.update((c) => Math.max(0, c - 1));
    await this.api.write('POST', `/notifications/${n.id}/dismiss`).catch(() => undefined);
  }

  async readAll(): Promise<void> {
    const now = new Date().toISOString();
    this.items.update((list) => list.map((x) => ({ ...x, readAt: x.readAt ?? now })));
    this.unread.set(0);
    await this.api.write('POST', '/notifications/read-all').catch(() => undefined);
  }
}
