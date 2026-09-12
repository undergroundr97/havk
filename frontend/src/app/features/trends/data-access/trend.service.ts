import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../../../core/config/api-config';
import { TrendResult, TrendSearch, TrendSearchPage, TrendSearchRequest, TrustedSource, YouTubeNicheCollectionRun } from './trend.models';

@Injectable({ providedIn: 'root' })
export class TrendService {
  private readonly http = inject(HttpClient); private readonly config = inject(API_CONFIG);
  listSources(): Observable<readonly TrustedSource[]> { return this.http.get<readonly TrustedSource[]>(`${this.base}/api/trend-sources`); }
  search(accountId: string, request: TrendSearchRequest): Observable<TrendSearch> {
    return this.http.post<TrendSearch>(`${this.account(accountId)}/trend-searches`, request);
  }
  rankCollectedSnapshots(accountId: string): Observable<TrendSearch> {
    return this.http.post<TrendSearch>(`${this.account(accountId)}/youtube-niche-rankings`, null);
  }
  latestCollectedSnapshots(accountId: string): Observable<YouTubeNicheCollectionRun | null> {
    return this.http.get<YouTubeNicheCollectionRun | null>(`${this.account(accountId)}/youtube-niche-collections/latest`);
  }
  latestYouTubeRanking(accountId: string): Observable<TrendSearch> {
    return this.http.get<TrendSearch>(`${this.account(accountId)}/youtube-niche-rankings/latest`);
  }
  history(accountId: string, page = 0, size = 20): Observable<TrendSearchPage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<TrendSearchPage>(`${this.account(accountId)}/trend-searches`, { params });
  }
  get(accountId: string, searchId: string): Observable<TrendSearch> {
    return this.http.get<TrendSearch>(`${this.account(accountId)}/trend-searches/${encodeURIComponent(searchId)}`);
  }
  select(accountId: string, searchId: string, resultIds: readonly string[]): Observable<TrendSearch> {
    return this.http.put<TrendSearch>(`${this.account(accountId)}/trend-searches/${encodeURIComponent(searchId)}/selections`, { resultIds });
  }
  selected(accountId: string): Observable<readonly TrendResult[]> { return this.http.get<readonly TrendResult[]>(`${this.account(accountId)}/selected-trends`); }
  private account(id: string): string { return `${this.base}/api/platform-accounts/${encodeURIComponent(id)}`; }
  private get base(): string { return this.config.baseUrl.replace(/\/$/, ''); }
}
