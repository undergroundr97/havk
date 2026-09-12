import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { ChannelResponse } from '../../data-access/channel.models';
import { ChannelService } from '../../data-access/channel.service';
import { ChannelForm } from './channel-form';

describe('ChannelForm', () => {
  const getChannel = vi.fn<() => Promise<ChannelResponse>>();
  const createChannel = vi.fn(() => Promise.resolve(channel));
  const updateChannel = vi.fn(() => Promise.resolve(channel));
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getChannel.mockReset();
    createChannel.mockReset();
    updateChannel.mockReset();
    getChannel.mockResolvedValue(channel);
    createChannel.mockResolvedValue(channel);
    updateChannel.mockResolvedValue(channel);
    TestBed.configureTestingModule({
      imports: [ChannelForm],
      providers: [
        provideRouter([]),
        { provide: ChannelService, useValue: { getChannel, createChannel, updateChannel } },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  it('starts the create flow with an empty typed form', () => {
    const fixture = createFixture('create');

    expect(getChannel).not.toHaveBeenCalled();
    expect(inputValue(fixture.nativeElement, '#channel-name')).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Cadastre seu canal');
  });

  it('validates required fields before creation', async () => {
    const fixture = createFixture('create');
    submitForm(fixture.nativeElement);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createChannel).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Informe o nome do canal.');
    expect(fixture.nativeElement.textContent).toContain('Informe a URL do canal.');
    expect(fixture.nativeElement.textContent).toContain('Informe a categoria do canal.');
    expect(fixture.nativeElement.textContent).toContain('Informe o idioma do canal.');
  });

  it('rejects an invalid URL and approximate size', async () => {
    const fixture = createFixture('create');
    fillRequiredFields(fixture.nativeElement);
    fill(fixture.nativeElement, '#channel-url', 'youtube.com/havk');
    fill(fixture.nativeElement, '#channel-size', '-3');
    submitForm(fixture.nativeElement);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createChannel).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Informe uma URL completa iniciada por http:// ou https://.',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Informe um número inteiro entre 0 e 10 bilhões.',
    );
  });

  it('creates a channel from an explicitly converted request and redirects to the summary', async () => {
    const fixture = createFixture('create');
    fillRequiredFields(fixture.nativeElement);
    fill(fixture.nativeElement, '#channel-description', '  Conteúdo para criadores.  ');
    fill(fixture.nativeElement, '#channel-size', '1200');
    submitForm(fixture.nativeElement);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createChannel).toHaveBeenCalledWith({
      platform: 'YOUTUBE',
      name: 'Canal HAVK',
      description: 'Conteúdo para criadores.',
      url: 'https://youtube.com/@havk',
      externalIdentifier: null,
      approximateSize: 1200,
      mainCategory: 'Educação',
      language: 'Português',
    });
    expect(navigateByUrl).toHaveBeenCalledWith('/canal');
    expect(fixture.nativeElement.textContent).toContain('Canal salvo com sucesso.');
  });

  it('loads and updates an existing channel through the shared form', async () => {
    const fixture = createFixture('edit');
    expect(fixture.nativeElement.textContent).toContain('Carregando o canal');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(inputValue(fixture.nativeElement, '#channel-name')).toBe('Canal HAVK');
    fill(fixture.nativeElement, '#channel-name', 'Canal atualizado');
    submitForm(fixture.nativeElement);
    await fixture.whenStable();

    expect(updateChannel).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Canal atualizado' }),
    );
    expect(navigateByUrl).toHaveBeenCalledWith('/canal');
  });

  it('represents an absent channel as an empty edit state', async () => {
    getChannel.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    const fixture = createFixture('edit');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nenhum canal foi cadastrado');
    expect(fixture.nativeElement.querySelector('a[href="/canal/novo"]')).not.toBeNull();
  });

  it('shows a comprehensible API error', async () => {
    createChannel.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Os dados enviados são inválidos.',
          status: 400,
          timestamp: '2026-07-22T12:00:00Z',
          path: '/api/channel',
          details: [],
        },
      }),
    );
    const fixture = createFixture('create');
    fillRequiredFields(fixture.nativeElement);
    submitForm(fixture.nativeElement);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Os dados enviados são inválidos.');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('prevents duplicate submissions and represents loading and success states', async () => {
    let resolveCreate: ((value: ChannelResponse) => void) | undefined;
    createChannel.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    const fixture = createFixture('create');
    fillRequiredFields(fixture.nativeElement);
    submitForm(fixture.nativeElement);
    submitForm(fixture.nativeElement);
    await Promise.resolve();
    fixture.detectChanges();

    expect(createChannel).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Salvando o canal');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      )?.disabled,
    ).toBe(true);

    resolveCreate?.(channel);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Canal salvo com sucesso.');
  });

  function createFixture(mode: 'create' | 'edit') {
    const fixture = TestBed.createComponent(ChannelForm);
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
    return fixture;
  }
});

const channel: ChannelResponse = {
  id: 'channel-1',
  platform: 'YOUTUBE',
  name: 'Canal HAVK',
  description: 'Conteúdo para criadores.',
  url: 'https://youtube.com/@havk',
  externalIdentifier: null,
  approximateSize: 1200,
  mainCategory: 'Educação',
  language: 'Português',
  createdAt: '2026-07-22T12:00:00Z',
  updatedAt: '2026-07-22T12:00:00Z',
};

function fillRequiredFields(element: HTMLElement): void {
  fill(element, '#channel-name', 'Canal HAVK');
  fill(element, '#channel-url', 'https://youtube.com/@havk');
  fill(element, '#channel-category', 'Educação');
  fill(element, '#channel-language', 'Português');
}

function fill(element: HTMLElement, selector: string, value: string): void {
  const control = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!control) throw new Error(`Control not found: ${selector}`);
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
}

function inputValue(element: HTMLElement, selector: string): string {
  const control = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!control) throw new Error(`Control not found: ${selector}`);
  return control.value;
}

function submitForm(element: HTMLElement): void {
  element
    .querySelector('form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
