import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { ChannelResponse, YouTubeConnectionResponse } from '../../data-access/channel.models';
import { ChannelService } from '../../data-access/channel.service';
import { ChannelSummaryPage } from './channel-summary-page';

describe('ChannelSummaryPage', () => {
  const getChannel = vi.fn<() => Promise<ChannelResponse>>();
  const deleteChannel = vi.fn(() => Promise.resolve());
  const getYouTubeConnection = vi.fn<() => Promise<YouTubeConnectionResponse>>();
  const startYouTubeConnection = vi.fn<(replace: boolean) => Promise<string>>();
  const refreshYouTubeConnection = vi.fn<() => Promise<YouTubeConnectionResponse>>();
  const disconnectYouTube = vi.fn(() => Promise.resolve());
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getChannel.mockReset();
    deleteChannel.mockReset();
    getYouTubeConnection.mockReset();
    startYouTubeConnection.mockReset();
    refreshYouTubeConnection.mockReset();
    disconnectYouTube.mockReset();
    getChannel.mockResolvedValue(channel);
    deleteChannel.mockResolvedValue();
    getYouTubeConnection.mockResolvedValue(notConnected);
    startYouTubeConnection.mockResolvedValue('https://accounts.example/authorize');
    refreshYouTubeConnection.mockResolvedValue(connected);
    disconnectYouTube.mockResolvedValue();
    TestBed.configureTestingModule({
      imports: [ChannelSummaryPage],
      providers: [
        provideRouter([]),
        { provide: ChannelService, useValue: { getChannel, deleteChannel, getYouTubeConnection, startYouTubeConnection, refreshYouTubeConnection, disconnectYouTube } },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  it('represents loading and renders the loaded channel summary', async () => {
    let resolveChannel: ((value: ChannelResponse) => void) | undefined;
    getChannel.mockReturnValue(
      new Promise((resolve) => {
        resolveChannel = resolve;
      }),
    );
    const fixture = createFixture();

    expect(fixture.nativeElement.textContent).toContain('Carregando o canal');
    resolveChannel?.(channel);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Canal HAVK');
    expect(fixture.nativeElement.textContent).toContain('1.200');
    expect(fixture.nativeElement.querySelector('a[href="/canal/editar"]')).not.toBeNull();
  });

  it('renders the empty state with a registration route', async () => {
    getChannel.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nenhum canal cadastrado');
    expect(fixture.nativeElement.querySelector('a[href="/canal/novo"]')).not.toBeNull();
  });

  it('renders an API failure and permits retry', async () => {
    getChannel.mockRejectedValue(new HttpErrorResponse({ status: 503 }));
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar o canal.');
    getChannel.mockResolvedValue(channel);
    click(fixture.nativeElement, '.state-card button');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Canal HAVK');
  });

  it('deletes the channel and redirects to registration', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();
    click(fixture.nativeElement, '.danger-action');
    await fixture.whenStable();

    expect(deleteChannel).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith('/canal/novo');
  });

  it('requires explicit confirmation before replacing a manual external identifier', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();
    click(fixture.nativeElement, '.connection-actions button');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Confirmar identificador do canal');
    expect(startYouTubeConnection).not.toHaveBeenCalled();
  });

  it('announces reauthorization and keeps the manual fallback available', async () => {
    getYouTubeConnection.mockResolvedValue({ ...notConnected, status: 'REAUTHORIZATION_REQUIRED' });
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reconectar YouTube');
    expect(fixture.nativeElement.querySelector('a[href="/canal/editar"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('traps confirmation focus, supports Escape and restores focus to disconnect', async () => {
    getYouTubeConnection.mockResolvedValue(connected);
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector<HTMLButtonElement>('.connection-actions .danger-action')!;
    trigger.click();
    fixture.detectChanges();
    await Promise.resolve();
    const dialog = root.querySelector<HTMLElement>('[aria-labelledby="disconnect-title"]')!;
    expect(document.activeElement).toBe(dialog.querySelector('button'));
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await Promise.resolve();
    expect(fixture.nativeElement.querySelector('[aria-labelledby="disconnect-title"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(disconnectYouTube).not.toHaveBeenCalled();
  });

  it('disconnects only after explicit confirmation and preserves the public channel', async () => {
    getYouTubeConnection.mockResolvedValueOnce(connected).mockResolvedValueOnce({ ...connected, status: 'DISCONNECTED' });
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();
    click(fixture.nativeElement, '.connection-actions .danger-action');
    fixture.detectChanges();
    click(fixture.nativeElement, '.confirmation .danger-action');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(disconnectYouTube).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('dados foram preservados');
    expect(fixture.nativeElement.textContent).toContain('Canal HAVK');
  });

  function createFixture() {
    const fixture = TestBed.createComponent(ChannelSummaryPage);
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
  externalIdentifier: 'UC-HAVK',
  dataOrigin: 'MANUAL',
  approximateSize: 1200,
  mainCategory: 'Educação',
  language: 'Português',
  createdAt: '2026-07-22T12:00:00Z',
  updatedAt: '2026-07-22T12:00:00Z',
};

const notConnected: YouTubeConnectionResponse = { status: 'NOT_CONNECTED', channelName: null, channelExternalId: null, channelUrl: null, connectedAt: null, accessTokenExpiresAt: null, failureCode: null };
const connected: YouTubeConnectionResponse = { ...notConnected, status: 'CONNECTED', channelName: 'Canal HAVK', channelExternalId: 'UC-HAVK', channelUrl: channel.url };

function click(element: HTMLElement, selector: string): void {
  const button = element.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`Button not found: ${selector}`);
  button.click();
}
