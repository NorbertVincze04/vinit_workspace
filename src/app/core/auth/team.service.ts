import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';

export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: 'owner' | 'member';
}

/** The (max 3) team members, for "assigned to" pickers. Loaded once. */
@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly api = inject(ApiService);
  readonly members = signal<readonly TeamMember[]>([]);
  readonly options = computed(() => this.members().map((m) => ({ value: m.id, label: m.fullName })));

  constructor() {
    this.api.get<{ items: TeamMember[] }>('/users').then(
      (res) => this.members.set(res.items),
      () => undefined,
    );
  }
}
