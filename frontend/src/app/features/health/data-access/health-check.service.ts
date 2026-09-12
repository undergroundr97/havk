import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api-config';
import { HealthCheckResponse } from './health-check.model';

@Injectable({ providedIn: 'root' })
export class HealthCheckService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);

  check(): Observable<HealthCheckResponse> {
    const baseUrl = this.apiConfig.baseUrl.replace(/\/$/, '');
    return this.http.get<HealthCheckResponse>(`${baseUrl}/api/health`);
  }
}
