import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api-config';
import { ChannelRequest, ChannelResponse, YouTubeAuthorizationResponse, YouTubeConnectionResponse, YouTubeSynchronizationResponse } from './channel.models';
import { parseYouTubeConnection } from './youtube-connection.parser';
import { parseYouTubeSynchronization } from './youtube-synchronization.parser';

@Injectable({ providedIn: 'root' })
export class ChannelService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);

  getChannel(): Promise<ChannelResponse> {
    return firstValueFrom(this.http.get<ChannelResponse>(this.url));
  }

  createChannel(request: ChannelRequest): Promise<ChannelResponse> {
    return firstValueFrom(this.http.post<ChannelResponse>(this.url, request));
  }

  updateChannel(request: ChannelRequest): Promise<ChannelResponse> {
    return firstValueFrom(this.http.put<ChannelResponse>(this.url, request));
  }

  deleteChannel(): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url).pipe(map(() => undefined)));
  }

  getYouTubeConnection(): Promise<YouTubeConnectionResponse> {
    return firstValueFrom(this.http.get<unknown>(this.connectionUrl).pipe(map(parseYouTubeConnection)));
  }

  async startYouTubeConnection(replaceManualChannel: boolean): Promise<string> {
    const response = await firstValueFrom(this.http.post<YouTubeAuthorizationResponse>(
      `${this.connectionUrl}/authorize`, { returnUrl: '/canal', replaceManualChannel },
    ));
    if (/^https:\/\//i.test(response.authorizationUrl)) return response.authorizationUrl;
    if (!response.authorizationUrl.startsWith('/')) throw new Error('Invalid authorization URL');
    return `${this.apiConfig.baseUrl.replace(/\/$/, '')}${response.authorizationUrl}`;
  }

  refreshYouTubeConnection(): Promise<YouTubeConnectionResponse> {
    return firstValueFrom(this.http.post<unknown>(`${this.connectionUrl}/refresh`, null).pipe(map(parseYouTubeConnection)));
  }

  disconnectYouTube(): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.connectionUrl}/disconnect`, null).pipe(map(() => undefined)));
  }

  getLatestYouTubeSynchronization(): Promise<YouTubeSynchronizationResponse | null> {
    return firstValueFrom(this.http.get<unknown>(`${this.synchronizationUrl}/latest`).pipe(map(parseYouTubeSynchronization)));
  }

  synchronizeYouTube(): Promise<YouTubeSynchronizationResponse> {
    const idempotencyKey = globalThis.crypto.randomUUID();
    return firstValueFrom(this.http.post<unknown>(this.synchronizationUrl, { idempotencyKey }).pipe(map((value) => {
      const parsed = parseYouTubeSynchronization(value);
      if (!parsed) throw new Error('Empty synchronization response');
      return parsed;
    })));
  }

  private get url(): string {
    return `${this.apiConfig.baseUrl.replace(/\/$/, '')}/api/channel`;
  }

  private get connectionUrl(): string {
    return `${this.apiConfig.baseUrl.replace(/\/$/, '')}/api/youtube/connection`;
  }

  private get synchronizationUrl(): string {
    return `${this.apiConfig.baseUrl.replace(/\/$/, '')}/api/youtube/synchronizations`;
  }
}
