import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PlatformAccountContextStore } from '../../data-access/platform-account-context.store';
import { TEST_PLATFORM_ACCOUNT } from '../../testing/platform-account-context.stub';
import { PlatformAccountSelector } from './platform-account-selector';

describe('PlatformAccountSelector', () => {
  it('keeps a sole account visible and selected', async () => {
    const context = contextStub([TEST_PLATFORM_ACCOUNT], TEST_PLATFORM_ACCOUNT.id, 'ready');
    TestBed.configureTestingModule({
      imports: [PlatformAccountSelector],
      providers: [{ provide: PlatformAccountContextStore, useValue: context }],
    });

    const fixture = TestBed.createComponent(PlatformAccountSelector);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe(TEST_PLATFORM_ACCOUNT.id);
    expect(fixture.nativeElement.textContent).toContain('YouTube');
    expect(fixture.nativeElement.textContent).toContain('Canal HAVK');
  });

  it('requires an explicit choice when multiple accounts exist and changes the signal context', async () => {
    const instagram = { ...TEST_PLATFORM_ACCOUNT, id: '00000000-0000-4000-8000-000000000004',
      platformCode: 'INSTAGRAM', platformName: 'Instagram', displayName: 'Conta carreira', handle: '@carreira' };
    const context = contextStub([TEST_PLATFORM_ACCOUNT, instagram], null, 'selection-required');
    TestBed.configureTestingModule({
      imports: [PlatformAccountSelector],
      providers: [{ provide: PlatformAccountContextStore, useValue: context }],
    });

    const fixture = TestBed.createComponent(PlatformAccountSelector);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.options).toHaveLength(3);
    select.value = instagram.id;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(context.selectedId()).toBe(instagram.id);
    expect(fixture.nativeElement.textContent).toContain('Conta carreira');
  });

  it.each([
    ['loading', 'Carregando contas'],
    ['empty', 'Nenhuma conta cadastrada'],
    ['error', 'Falha ao carregar'],
  ])('exposes an accessible %s state', async (status, expected) => {
    const context = contextStub([], null, status, status === 'error' ? 'Falha ao carregar' : null);
    TestBed.configureTestingModule({
      imports: [PlatformAccountSelector],
      providers: [{ provide: PlatformAccountContextStore, useValue: context }],
    });
    const fixture = TestBed.createComponent(PlatformAccountSelector);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(expected);
    if (status === 'error') expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});

function contextStub(accountsValue: readonly typeof TEST_PLATFORM_ACCOUNT[], selectedValue: string | null,
    statusValue: string, errorValue: string | null = null) {
  const accounts = signal(accountsValue);
  const selectedId = signal(selectedValue);
  const status = signal(statusValue);
  const error = signal(errorValue);
  return {
    accounts, selectedId, status, error,
    selected: computed(() => accounts().find((account) => account.id === selectedId()) ?? null),
    load: async () => undefined,
    select: (id: string) => { selectedId.set(id); status.set('ready'); },
    clear: () => { selectedId.set(null); status.set(accounts().length > 1 ? 'selection-required' : 'empty'); },
  };
}
