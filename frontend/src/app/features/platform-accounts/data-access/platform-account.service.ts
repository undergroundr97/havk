import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_CONFIG } from '../../../core/config/api-config';
import { PlatformAccount, PlatformAccountRequest, PlatformDefinition } from './platform-account.models';
import { parsePlatformAccount, parsePlatformAccounts, parsePlatforms } from './platform-account.parser';

@Injectable({ providedIn: 'root' })
export class PlatformAccountService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);
  private readonly base = `${this.config.baseUrl.replace(/\/$/, '')}/api`;

  list(includeArchived = false): Observable<readonly PlatformAccount[]> {
    const params = new HttpParams().set('includeArchived', includeArchived);
    return this.http.get<unknown>(`${this.base}/platform-accounts`, { params }).pipe(map(parsePlatformAccounts));
  }
  platforms(): Observable<readonly PlatformDefinition[]> {
    return this.http.get<unknown>(`${this.base}/platforms`).pipe(map(parsePlatforms));
  }
  create(request: PlatformAccountRequest): Observable<PlatformAccount> {
    return this.http.post<unknown>(`${this.base}/platform-accounts`, request).pipe(map(parsePlatformAccount));
  }
  update(id: string, request: PlatformAccountRequest): Observable<PlatformAccount> {
    return this.http.put<unknown>(`${this.base}/platform-accounts/${id}`, request).pipe(map(parsePlatformAccount));
  }
  archive(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/platform-accounts/${id}`); }
}
