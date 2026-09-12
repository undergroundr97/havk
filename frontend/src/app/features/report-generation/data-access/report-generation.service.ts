import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { map, Observable } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api-config';
import { ReportService } from '../../reports/data-access/report.service';
import { ReportProgressService } from './report-progress.service';
import {
  CreateReportRequest,
  ReportPollingEvent,
  ReportPreviewResponse,
  ReportRequestAcceptedResponse,
  ReportRequestResponse,
  ReportRequestStatus,
} from './report-generation.models';

/** @deprecated F32 uses SSE; retained only for source compatibility of older test configuration. */
export const REPORT_POLL_INTERVAL_MS = new InjectionToken<number>('REPORT_POLL_INTERVAL_MS', {
  providedIn: 'root',
  factory: () => 2_000,
});

@Injectable({ providedIn: 'root' })
export class ReportGenerationService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);
  private readonly progress = inject(ReportProgressService);
  private readonly reports = inject(ReportService);

  createRequest(request: CreateReportRequest): Observable<ReportRequestAcceptedResponse> {
    return this.http.post<unknown>(this.requestsUrl, request).pipe(map(parseAcceptedReportRequest));
  }

  getRequest(requestId: string): Observable<ReportRequestResponse> {
    return this.http
      .get<unknown>(`${this.requestsUrl}/${encodeURIComponent(requestId)}`)
      .pipe(map(parseReportRequest));
  }

  watchRequest(requestId: string): Observable<ReportPollingEvent> {
    const requestUrl = `${this.requestsUrl}/${encodeURIComponent(requestId)}`;
    return this.progress.watch(requestId, `${requestUrl}/events`, () => this.getRequest(requestId));
  }

  getReport(reportId: string): Observable<ReportPreviewResponse> {
    return this.reports.getReport(reportId).pipe(
    map(({ id, requestId, platformAccountId, channelId, title, summary, generatedAt }) => ({
        id,
        requestId,
        platformAccountId,
        channelId,
        title,
        summary,
        generatedAt,
      })),
    );
  }

  private get requestsUrl(): string {
    return `${this.baseUrl}/api/report-requests`;
  }

  private get baseUrl(): string {
    return this.apiConfig.baseUrl.replace(/\/$/, '');
  }
}

const REQUEST_STATUSES = new Set<ReportRequestStatus>([
  'QUEUED',
  'DISCOVERING_CONTENT',
  'SELECTING_CONTENT',
  'ANALYZING_CONTENT',
  'FINDING_OPPORTUNITIES',
  'BUILDING_STRATEGY',
  'GENERATING_REPORT',
  'COMPLETED',
  'NO_RELEVANT_OPPORTUNITY',
  'FAILED',
  'CANCELLED',
]);

class InvalidReportResponseError extends Error {}

function parseAcceptedReportRequest(value: unknown): ReportRequestAcceptedResponse {
  if (!isRecord(value)) {
    throw new InvalidReportResponseError('Invalid accepted report request response.');
  }
  const requestId = value['requestId'];
  const status = value['status'];
  if (typeof requestId !== 'string' || requestId.length === 0 || !isReportRequestStatus(status)) {
    throw new InvalidReportResponseError('Invalid accepted report request response.');
  }
  return {
    requestId,
    status,
    conversationId: optionalNullableString(value['conversationId']) ?? undefined,
    generationStrategy: optionalGenerationStrategy(value['generationStrategy']) ?? undefined,
    sourceMode: optionalSourceMode(value['sourceMode']) ?? undefined,
    effectiveIdeaCount: optionalNumber(value['effectiveIdeaCount']),
    contextSummary: optionalNullableString(value['contextSummary']) ?? undefined,
  };
}

export function parseReportRequest(value: unknown): ReportRequestResponse {
  if (!isRecord(value)) {
    throw new InvalidReportResponseError('Invalid report request response.');
  }
  const requestId = value['requestId'];
  const status = value['status'];
  if (typeof requestId !== 'string' || requestId.length === 0) {
    throw new InvalidReportResponseError('Invalid report request response.');
  }
  if (!isReportRequestStatus(status)) {
    throw new InvalidReportResponseError('Invalid report request status.');
  }
  const processingStep = optionalNullableString(value['processingStep']);
  const reportId = optionalNullableString(value['reportId']);
  const failureCode = optionalNullableString(value['failureCode']);
  const failureMessage = optionalNullableString(value['failureMessage']);
  const completedAt = optionalNullableString(value['completedAt']);
  const failedAt = optionalNullableString(value['failedAt']);
  const createdAt = optionalNullableString(value['createdAt']) ?? undefined;
  const startedAt = optionalNullableString(value['startedAt']);
  const cancelledAt = optionalNullableString(value['cancelledAt']);
  const updatedAt = value['updatedAt'];
  if (updatedAt !== undefined && typeof updatedAt !== 'string') {
    throw new InvalidReportResponseError('Invalid report request update timestamp.');
  }
  return {
    requestId,
    status,
    conversationId: optionalNullableString(value['conversationId']) ?? undefined,
    platformAccountId: optionalNullableString(value['platformAccountId']) ?? undefined,
    channelId: optionalNullableString(value['channelId']),
    topic: optionalNullableString(value['topic']),
    objective: optionalNullableString(value['objective']) ?? undefined,
    instructions: optionalNullableString(value['instructions']),
    generationMode: optionalGenerationMode(value['generationMode']),
    selectedTrendIds: optionalStringArray(value['selectedTrendIds']),
    ideaCount: optionalNumber(value['ideaCount']),
    methodology: value['methodology'] === 'HOOK_PROBLEM_SOLUTION_DIFFERENTIATOR'
      ? value['methodology'] : undefined,
    trendSearchId: optionalNullableString(value['trendSearchId']),
    reportVersion: optionalNumber(value['reportVersion']),
    regeneratedFromReportId: optionalNullableString(value['regeneratedFromReportId']),
    processingStep,
    attemptCount: optionalNumber(value['attemptCount']),
    nextAttemptAt: optionalNullableString(value['nextAttemptAt']),
    failureCategory: optionalNullableString(value['failureCategory']),
    reportId,
    failureCode,
    failureMessage,
    createdAt,
    updatedAt,
    startedAt,
    completedAt,
    failedAt,
    cancelledAt,
    generationStrategy: optionalGenerationStrategy(value['generationStrategy']),
    sourceMode: optionalSourceMode(value['sourceMode']),
    effectiveIdeaCount: optionalNumber(value['effectiveIdeaCount']),
    contextSummary: optionalNullableString(value['contextSummary']),
    contextCapturedAt: optionalNullableString(value['contextCapturedAt']),
    originalUserQuery: optionalNullableString(value['originalUserQuery']) ?? undefined,
    progressPercent: optionalNumber(value['progressPercent']),
    progressMessage: optionalNullableString(value['progressMessage']) ?? undefined,
    terminal: optionalBoolean(value['terminal']),
    resultAvailable: optionalBoolean(value['resultAvailable']),
  };
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  throw new InvalidReportResponseError('Invalid boolean report request field.');
}

function isReportRequestStatus(value: unknown): value is ReportRequestStatus {
  return typeof value === 'string' && REQUEST_STATUSES.has(value as ReportRequestStatus);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalNullableString(value: unknown): string | null | undefined {
  if (value === undefined || value === null || typeof value === 'string') return value;
  throw new InvalidReportResponseError('Invalid report request fields.');
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  throw new InvalidReportResponseError('Invalid numeric report request field.');
}

function optionalStringArray(value: unknown): readonly string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  throw new InvalidReportResponseError('Invalid report request list field.');
}

function optionalGenerationMode(value: unknown): ReportRequestResponse['generationMode'] {
  if (value === undefined || value === null) return undefined;
  if (value === 'USER_DIRECTED' || value === 'USER_DIRECTED_WITH_TRENDS'
      || value === 'AUTOMATIC_TREND_DISCOVERY') return value;
  throw new InvalidReportResponseError('Invalid report generation mode.');
}

function optionalGenerationStrategy(value: unknown): ReportRequestResponse['generationStrategy'] {
  if (value === undefined || value === null) return value;
  if (value === 'SURPRISE_ME' || value === 'TOPIC_GUIDED') return value;
  throw new InvalidReportResponseError('Invalid report generation strategy.');
}

function optionalSourceMode(value: unknown): ReportRequestResponse['sourceMode'] {
  if (value === undefined || value === null) return value;
  if (value === 'YOUTUBE_NICHE_RANKING' || value === 'YOUTUBE_NICHE_RANKING_WITH_TOPIC'
      || value === 'PROFILE_AND_CHANNEL_CONTEXT' || value === 'PROFILE_CONTEXT' || value === 'LEGACY') return value;
  throw new InvalidReportResponseError('Invalid report source mode.');
}
