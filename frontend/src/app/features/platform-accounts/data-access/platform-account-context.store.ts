import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PlatformAccount } from './platform-account.models';
import { PlatformAccountService } from './platform-account.service';

export type AccountContextStatus = 'idle' | 'loading' | 'empty' | 'selection-required' | 'ready' | 'error';

@Injectable({ providedIn: 'root' })
export class PlatformAccountContextStore {
  private readonly service = inject(PlatformAccountService);
  readonly accounts = signal<readonly PlatformAccount[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly status = signal<AccountContextStatus>('idle');
  readonly error = signal<string | null>(null);
  readonly selected = computed(() => this.accounts().find((account) => account.id === this.selectedId()) ?? null);

  async load(force = false): Promise<void> {
    if (!force && (this.status() === 'ready' || this.status() === 'selection-required')) return;
    this.status.set('loading'); this.error.set(null);
    try {
      const accounts = await firstValueFrom(this.service.list());
      this.accounts.set(accounts);
      const current = this.selectedId();
      if (current && accounts.some((account) => account.id === current)) { this.status.set('ready'); return; }
      if (accounts.length === 1) { this.selectedId.set(accounts[0]?.id ?? null); this.status.set('ready'); return; }
      this.selectedId.set(null);
      this.status.set(accounts.length === 0 ? 'empty' : 'selection-required');
    } catch {
      this.accounts.set([]); this.selectedId.set(null); this.error.set('Não foi possível carregar suas contas.');
      this.status.set('error');
    }
  }

  select(id: string): void {
    if (!this.accounts().some((account) => account.id === id && !account.archived)) return;
    this.selectedId.set(id); this.status.set('ready'); this.error.set(null);
  }

  clear(): void { this.selectedId.set(null); this.status.set(this.accounts().length > 1 ? 'selection-required' : 'empty'); }
}
