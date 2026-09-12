import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api-config';
import { DashboardResponse } from './dashboard.models';
import { parseDashboardResponse } from './dashboard.parser';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);

  getDashboard(platformAccountId: string | null = null): Observable<DashboardResponse> {
    const params = platformAccountId ? new HttpParams().set('platformAccountId', platformAccountId) : undefined;
    return this.http.get<unknown>(this.dashboardUrl, { params }).pipe(map(parseDashboardResponse));
  }

  private get dashboardUrl(): string {
    return `${this.apiConfig.baseUrl.replace(/\/$/, '')}/api/dashboard`;
  }
}
