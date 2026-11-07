import { Injectable, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { BackupCheck, InfraHealth, InfraService, SmsUsage } from './infra.model';

type Row = Record<string, unknown>;

/** Infra: services and their cost, SMS usage, backups and the health summary. */
@Injectable({ providedIn: 'root' })
export class InfraStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly services = signal<readonly InfraService[]>([]);
  readonly health = signal<InfraHealth | null>(null);
  readonly backups = signal<readonly BackupCheck[]>([]);
  readonly loaded = signal(false);

  async reload(): Promise<void> {
    try {
      const [services, health, backups] = await Promise.all([
        this.api.get<{ items: InfraService[] }>('/infra/services'),
        this.api.get<InfraHealth>('/infra/health'),
        this.api.get<{ items: BackupCheck[] }>('/infra/backup-checks'),
      ]);
      this.services.set(services.items);
      this.health.set(health);
      this.backups.set(backups.items);
      this.loaded.set(true);
    } catch (error) {
      this.toast.show(`Could not load Infra: ${apiError(error).message}`, 6000);
    }
  }

  async sms(month: string): Promise<SmsUsage[]> {
    try {
      return (await this.api.get<{ items: SmsUsage[] }>('/infra/sms-usage', { month })).items;
    } catch {
      return [];
    }
  }

  saveService(id: string | null, body: Row): Promise<unknown> {
    return id ? this.write('PATCH', `/infra/services/${id}`, body) : this.write('POST', '/infra/services', body);
  }

  removeService(id: string): Promise<unknown> {
    return this.write('DELETE', `/infra/services/${id}`);
  }

  saveSms(body: Row): Promise<unknown> {
    return this.write('PUT', '/infra/sms-usage', body);
  }

  removeSms(id: string): Promise<unknown> {
    return this.write('DELETE', `/infra/sms-usage/${id}`);
  }

  recordBackup(body: Row): Promise<unknown> {
    return this.write('POST', '/infra/backup-checks', body);
  }

  private async write(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: Row): Promise<unknown> {
    try {
      const res = await this.api.write(method, path, body);
      void this.reload();
      return res;
    } catch (error) {
      this.toast.show(`Not saved: ${apiError(error).message}`, 6000);
      throw error;
    }
  }
}
