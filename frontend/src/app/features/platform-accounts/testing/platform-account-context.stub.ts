import { computed, signal } from '@angular/core';
import { PlatformAccount } from '../data-access/platform-account.models';

export const TEST_PLATFORM_ACCOUNT: PlatformAccount = {
  id: '00000000-0000-4000-8000-000000000003',
  platformCode: 'YOUTUBE',
  platformName: 'YouTube',
  displayName: 'Canal HAVK',
  handle: '@havk',
  externalIdentifier: 'UC-HAVK',
  publicUrl: 'https://www.youtube.com/@havk',
  description: null,
  language: 'pt-BR',
  region: 'BR',
  dataOrigin: 'SIMULATED',
  connectionStatus: 'CONNECTED',
  archived: false,
  primaryAccount: true,
  archivedAt: null,
  profileConfigured: true,
  profileReadiness: 'READY',
  trendGenerationAvailable: true,
  trendGenerationUnavailableReason: null,
  healthAvailability: 'AVAILABLE',
  lastSynchronizedAt: '2026-07-28T12:00:00Z',
  capabilities: {
    code: 'YOUTUBE', displayName: 'YouTube', manualRegistration: true, oauth: true,
    synchronization: true, automaticInference: true, health: true, analytics: true,
    futurePublishing: false, contentCapabilities: ['VIDEO', 'SHORT_FORM_VIDEO', 'LIVE_STREAM'],
  },
};

export function platformAccountContextStub(account: PlatformAccount | null = TEST_PLATFORM_ACCOUNT) {
  const accounts = signal<readonly PlatformAccount[]>(account ? [account] : []);
  const selectedId = signal<string | null>(account?.id ?? null);
  const status = signal(account ? 'ready' : 'empty');
  const error = signal<string | null>(null);
  return {
    accounts, selectedId, status, error,
    selected: computed(() => accounts().find((candidate) => candidate.id === selectedId()) ?? null),
    load: async () => undefined,
    select: (id: string) => { selectedId.set(id); status.set('ready'); },
    clear: () => { selectedId.set(null); status.set(accounts().length > 1 ? 'selection-required' : 'empty'); },
  };
}
