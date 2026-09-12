import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_CONFIG } from '../../../core/config/api-config';
import { ChannelRequest, ChannelResponse } from './channel.models';
import { ChannelService } from './channel.service';

describe('ChannelService', () => {
  let service: ChannelService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: 'http://api.test/' } },
      ],
    });
    service = TestBed.inject(ChannelService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the authenticated user channel', async () => {
    const promise = service.getChannel();
    http.expectOne('http://api.test/api/channel').flush(channel);

    await expect(promise).resolves.toEqual(channel);
  });

  it('creates the channel through POST', async () => {
    const promise = service.createChannel(request);
    const pending = http.expectOne('http://api.test/api/channel');

    expect(pending.request.method).toBe('POST');
    expect(pending.request.body).toEqual(request);
    pending.flush(channel);
    await expect(promise).resolves.toEqual(channel);
  });

  it('updates the channel through PUT', async () => {
    const promise = service.updateChannel(request);
    const pending = http.expectOne('http://api.test/api/channel');

    expect(pending.request.method).toBe('PUT');
    pending.flush(channel);
    await expect(promise).resolves.toEqual(channel);
  });

  it('deletes the channel through DELETE', async () => {
    const promise = service.deleteChannel();
    const pending = http.expectOne('http://api.test/api/channel');

    expect(pending.request.method).toBe('DELETE');
    pending.flush(null);
    await expect(promise).resolves.toBeUndefined();
  });

  it('loads and parses the secure YouTube connection status', async () => {
    const promise = service.getYouTubeConnection();
    http.expectOne('http://api.test/api/youtube/connection').flush(connection);
    await expect(promise).resolves.toEqual(connection);
  });

  it('rejects an invalid connection payload at the HTTP boundary', async () => {
    const promise = service.getYouTubeConnection();
    http.expectOne('http://api.test/api/youtube/connection').flush({ status: 'CONNECTED', channelName: 42 });
    await expect(promise).rejects.toThrow('Invalid YouTube connection response');
  });

  it('starts authorization without exposing credentials', async () => {
    const promise = service.startYouTubeConnection(true);
    const pending = http.expectOne('http://api.test/api/youtube/connection/authorize');
    expect(pending.request.method).toBe('POST');
    expect(pending.request.body).toEqual({ returnUrl: '/canal', replaceManualChannel: true });
    pending.flush({ authorizationUrl: '/api/youtube/oauth/fake/authorize?state=opaque', expiresAt: '2026-07-28T12:10:00Z' });
    await expect(promise).resolves.toBe('http://api.test/api/youtube/oauth/fake/authorize?state=opaque');
  });

  it('refreshes and disconnects the connection', async () => {
    const refresh = service.refreshYouTubeConnection();
    http.expectOne('http://api.test/api/youtube/connection/refresh').flush(connection);
    await expect(refresh).resolves.toEqual(connection);
    const disconnect = service.disconnectYouTube();
    http.expectOne('http://api.test/api/youtube/connection/disconnect').flush(null);
    await expect(disconnect).resolves.toBeUndefined();
  });
});

const request: ChannelRequest = {
  platform: 'YOUTUBE',
  name: 'HAVK',
  description: null,
  url: 'https://youtube.com/@havk',
  externalIdentifier: null,
  approximateSize: 1200,
  mainCategory: 'Educação',
  language: 'Português',
};

const channel: ChannelResponse = {
  id: 'channel-1',
  ...request,
  createdAt: '2026-07-22T12:00:00Z',
  updatedAt: '2026-07-22T12:00:00Z',
};

const connection = {
  status: 'CONNECTED' as const,
  channelName: 'HAVK',
  channelExternalId: 'UC-HAVK',
  channelUrl: 'https://youtube.com/@havk',
  connectedAt: '2026-07-28T12:00:00Z',
  accessTokenExpiresAt: '2026-07-28T13:00:00Z',
  failureCode: null,
};
