import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../../../core/config/api-config';
import { ContentItem, ContentMemoryPage, TranscriptRequest } from './content-memory.models';

@Injectable({ providedIn: 'root' })
export class ContentMemoryService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);
  list(accountId: string, page = 0, size = 50): Observable<ContentMemoryPage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ContentMemoryPage>(this.items(accountId), { params });
  }
  addTranscript(accountId: string, contentId: string, request: TranscriptRequest): Observable<unknown> {
    return this.http.post(`${this.item(accountId, contentId)}/transcripts`, request);
  }
  analyze(accountId: string, contentId: string): Observable<ContentItem> {
    return this.http.post<ContentItem>(`${this.item(accountId, contentId)}/analysis`, {});
  }
  private item(accountId: string, contentId: string): string {
    return `${this.items(accountId)}/${encodeURIComponent(contentId)}`;
  }
  private items(accountId: string): string {
    const base = this.config.baseUrl.replace(/\/$/, '');
    return `${base}/api/platform-accounts/${encodeURIComponent(accountId)}/content-items`;
  }
}
