import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { PlatformAccountContextStore } from '../../data-access/platform-account-context.store';
import { PlatformAccount, PlatformAccountRequest, PlatformDefinition } from '../../data-access/platform-account.models';
import { PlatformAccountService } from '../../data-access/platform-account.service';
import { platformAccountContextStub, TEST_PLATFORM_ACCOUNT } from '../../testing/platform-account-context.stub';
import { PlatformAccountsPage } from './platform-accounts-page';

describe('PlatformAccountsPage', () => {
  const list = vi.fn();
  const platforms = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const archive = vi.fn();

  beforeEach(() => {
    list.mockReset().mockReturnValue(of([TEST_PLATFORM_ACCOUNT, archivedInstagram]));
    platforms.mockReset().mockReturnValue(of(definitions));
    create.mockReset().mockReturnValue(of(manualInstagram));
    update.mockReset().mockReturnValue(of(manualInstagram));
    archive.mockReset().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [PlatformAccountsPage],
      providers: [provideRouter([]),
        { provide: PlatformAccountService, useValue: { list, platforms, create, update, archive } },
        { provide: PlatformAccountContextStore, useFactory: platformAccountContextStub }],
    });
  });

  it('lists a responsive card grid with source, health and archived states', async () => {
    const fixture = TestBed.createComponent(PlatformAccountsPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Carregando contas');
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('.account-grid')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.account-card')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('SIMULATED');
    expect(fixture.nativeElement.textContent).toContain('Dados simulados');
    expect(fixture.nativeElement.textContent).toContain('Integração não disponível');
    expect(fixture.nativeElement.textContent).toContain('Arquivada');
    expect(fixture.nativeElement.querySelector('form[novalidate]')).not.toBeNull();
  });

  it('registers a manual account through Signal Forms without pretending OAuth exists', async () => {
    const fixture = await readyFixture();
    fill(fixture.nativeElement, '#display-name', '  Minha carreira  ');
    fill(fixture.nativeElement, '#handle', '  @minha.carreira  ');
    fill(fixture.nativeElement, '#public-url', 'https://instagram.com/minha.carreira');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable(); fixture.detectChanges();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      platformCode: 'INSTAGRAM', displayName: 'Minha carreira', handle: '@minha.carreira',
    } satisfies Partial<PlatformAccountRequest>));
    expect(fixture.nativeElement.textContent).toContain('Integração automática ainda não disponível');
  });

  it('renders an accessible error state when listing fails', async () => {
    list.mockReturnValue(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(PlatformAccountsPage);
    fixture.detectChanges(); await settle(fixture);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('carregar as contas');
  });

  it('asks for confirmation before archiving and preserves the history message', async () => {
    const fixture = await readyFixture();
    const archiveButton = [...fixture.nativeElement.querySelectorAll('button')]
      .find((button: HTMLButtonElement) => button.textContent?.includes('Arquivar')) as HTMLButtonElement;
    archiveButton.click(); fixture.detectChanges();
    expect(archive).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('histórico será preservado');
  });

  async function readyFixture() {
    const fixture = TestBed.createComponent(PlatformAccountsPage);
    fixture.detectChanges(); await settle(fixture);
    return fixture;
  }
});

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }): Promise<void> {
  await fixture.whenStable();
  await Promise.resolve();
  fixture.detectChanges();
}

function fill(root: HTMLElement, selector: string, value: string): void {
  const input = root.querySelector(selector) as HTMLInputElement;
  input.value = value; input.dispatchEvent(new Event('input'));
}

const definitions: readonly PlatformDefinition[] = [
  TEST_PLATFORM_ACCOUNT.capabilities,
  { code: 'INSTAGRAM', displayName: 'Instagram', manualRegistration: true, oauth: false,
    synchronization: false, automaticInference: false, health: false, analytics: false,
    futurePublishing: false, contentCapabilities: ['IMAGE', 'VIDEO', 'SHORT_FORM_VIDEO'] },
];

const manualInstagram: PlatformAccount = {
  ...TEST_PLATFORM_ACCOUNT, id: '00000000-0000-4000-8000-000000000004', platformCode: 'INSTAGRAM',
  platformName: 'Instagram', displayName: 'Minha carreira', handle: '@minha.carreira', dataOrigin: 'MANUAL',
  connectionStatus: 'INTEGRATION_UNAVAILABLE', healthAvailability: 'INTEGRATION_UNAVAILABLE',
  lastSynchronizedAt: null, capabilities: definitions[1]!,
};
const archivedInstagram: PlatformAccount = {
  ...manualInstagram, id: '00000000-0000-4000-8000-000000000005', displayName: 'Conta antiga', archived: true,
  archivedAt: '2026-07-28T12:00:00Z', connectionStatus: 'ARCHIVED',
};
