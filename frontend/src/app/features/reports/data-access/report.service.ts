import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api-config';
import { PageResponse, ReportDetailResponse, ReportRegenerationResponse, ReportSummaryResponse } from './report.models';
import { parseReportDetail, parseReportPage } from './report-response.parser';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);

  listReports(
    page = 0,
    size = 20,
    platformAccountId: string | null = null,
    platformCode: string | null = null,
  ): Observable<PageResponse<ReportSummaryResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (platformAccountId) params = params.set('platformAccountId', platformAccountId);
    if (platformCode) params = params.set('platformCode', platformCode);
    return this.http
      .get<unknown>(this.reportsUrl, { params })
      .pipe(map(parseReportPage));
  }

  getReport(reportId: string): Observable<ReportDetailResponse> {
    return this.http
      .get<unknown>(`${this.reportsUrl}/${encodeURIComponent(reportId)}`)
      .pipe(map(parseReportDetail));
  }

  deleteReport(reportId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.reportsUrl}/${encodeURIComponent(reportId)}`)
      .pipe(map(() => undefined));
  }

  regenerateReport(reportId: string, additionalInstructions: string | null = null): Observable<ReportRegenerationResponse> {
    return this.http.post<ReportRegenerationResponse>(
      `${this.reportsUrl}/${encodeURIComponent(reportId)}/regenerations`, { additionalInstructions },
    );
  }

  private get reportsUrl(): string {
    return `${this.apiConfig.baseUrl.replace(/\/$/, '')}/api/reports`;
  }
}
