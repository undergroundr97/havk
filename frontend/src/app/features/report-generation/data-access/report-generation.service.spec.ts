import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { API_CONFIG } from '../../../core/config/api-config';
import {
  ReportPreviewResponse,
  ReportRequestAcceptedResponse,
  ReportRequestResponse,
} from './report-generation.models';
import {
  REPORT_POLL_INTERVAL_MS,
  ReportGenerationService,
} from './report-generation.service';
import {
  REPORT_EVENT_SOURCE_FACTORY,
  REPORT_SSE_RECONNECT_MS,
  ReportEventSource,
} from './report-progress.service';

describe('ReportGenerationService', () => {
  let http: HttpTestingController;
  let service: ReportGenerationService;
  let sources: FakeEventSource[];

  beforeEach(() => {
    vi.useFakeTimers();
    sources = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: 'http://localhost:8080/' } },
        { provide: REPORT_POLL_INTERVAL_MS, useValue: 100 },
        { provide: REPORT_SSE_RECONNECT_MS, useValue: 100 },
        { provide: REPORT_EVENT_SOURCE_FACTORY, useValue: (url: string) => {
          const source = new FakeEventSource(url);
          sources.push(source);
          return source;
        } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ReportGenerationService);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('treats an HTTP 202 with the minimal asynchronous contract as accepted', () => {
    const response: ReportRequestAcceptedResponse = { requestId: 'request-1', status: 'QUEUED' };
    let received: ReportRequestAcceptedResponse | undefined;

    service
      .createRequest({
        platformAccountId: 'account-1', conversationId: null, generationMode: 'USER_DIRECTED',
        topic: 'Angular Signals', objective: 'Ensinar Signals',
        instructions: 'Priorize exemplos.', methodology: 'HOOK_PROBLEM_SOLUTION_DIFFERENTIATOR',
        selectedTrendIds: ['trend-1'], ideaCount: 1,
      })
      .subscribe((value) => (received = value));

    const request = http.expectOne('http://localhost:8080/api/report-requests');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      platformAccountId: 'account-1',
      conversationId: null,
      generationMode: 'USER_DIRECTED',
      topic: 'Angular Signals',
      objective: 'Ensinar Signals',
      instructions: 'Priorize exemplos.',
      methodology: 'HOOK_PROBLEM_SOLUTION_DIFFERENTIATOR',
      selectedTrendIds: ['trend-1'],
      ideaCount: 1,
    });
    request.flush(response, { status: 202, statusText: 'Accepted' });
    expect(received).toEqual(response);
  });

  it('accepts another valid 2xx response without requiring a report identifier', () => {
    let received: ReportRequestAcceptedResponse | undefined;
    service.createRequest({
      platformAccountId: 'account-1', conversationId: null, generationMode: 'USER_DIRECTED',
      topic: 'Angular Signals', objective: 'Ensinar Signals',
      instructions: null, methodology: 'HOOK_PROBLEM_SOLUTION_DIFFERENTIATOR',
      selectedTrendIds: [], ideaCount: 1,
    }).subscribe((value) => (received = value));

    http.expectOne('http://localhost:8080/api/report-requests').flush(
      { requestId: 'request-2', status: 'QUEUED' },
      { status: 200, statusText: 'OK' },
    );

    expect(received).toEqual({ requestId: 'request-2', status: 'QUEUED' });
  });

  it('loads an existing request for the authenticated tracking journey', () => {
    let received: ReportRequestResponse | undefined;
    service.getRequest('request-1').subscribe((value) => (received = value));

    const request = http.expectOne('http://localhost:8080/api/report-requests/request-1');
    expect(request.request.method).toBe('GET');
    request.flush(reportRequest('GENERATING_REPORT'));

    expect(received?.status).toBe('GENERATING_REPORT');
  });

  it('accepts minimal intermediate contracts with nullable or omitted fields', () => {
    const received: ReportRequestResponse[] = [];
    service.getRequest('request-1').subscribe((value) => received.push(value));
    http.expectOne('http://localhost:8080/api/report-requests/request-1').flush({
      requestId: 'request-1',
      status: 'QUEUED',
      processingStep: null,
      reportId: null,
      failureCode: null,
      failureMessage: null,
    });

    service.getRequest('request-2').subscribe((value) => received.push(value));
    http.expectOne('http://localhost:8080/api/report-requests/request-2').flush({
      requestId: 'request-2',
      status: 'GENERATING_REPORT',
      processingStep: 'GENERATING_REPORT',
    });

    expect(received).toEqual([
      {
        requestId: 'request-1',
        status: 'QUEUED',
        processingStep: null,
        reportId: null,
        failureCode: null,
        failureMessage: null,
      },
      {
        requestId: 'request-2',
        status: 'GENERATING_REPORT',
        processingStep: 'GENERATING_REPORT',
      },
    ]);
  });

  it('starts with REST, consumes SSE and recovers the final result through REST', () => {
    const statuses: string[] = [];
    service.watchRequest('request-1').subscribe((event) => {
      if (event.kind === 'update') statuses.push(event.request.status);
    });

    vi.advanceTimersByTime(0);
    http.expectOne('http://localhost:8080/api/report-requests/request-1').flush(
      reportRequest('GENERATING_REPORT'),
    );
    sources[0]?.emit(progressEvent('COMPLETED', true));
    http.expectOne('http://localhost:8080/api/report-requests/request-1').flush(
      reportRequest('COMPLETED', 'report-1'),
    );
    vi.advanceTimersByTime(500);

    expect(statuses).toEqual(['GENERATING_REPORT', 'COMPLETED']);
    expect(http.match('http://localhost:8080/api/report-requests/request-1')).toHaveLength(0);
  });

  it('recovers current state after SSE loss, reconnects, and cleans up on unsubscribe', () => {
    const subscription = service.watchRequest('request-1').subscribe();
    vi.advanceTimersByTime(0);
    http.expectOne('http://localhost:8080/api/report-requests/request-1').flush(
      reportRequest('ANALYZING_CONTENT'),
    );
    expect(sources).toHaveLength(1);

    sources[0].onerror?.(new Event('error'));
    expect(sources[0].closed).toBe(true);
    http.expectOne('http://localhost:8080/api/report-requests/request-1').flush(
      reportRequest('BUILDING_STRATEGY'),
    );
    vi.advanceTimersByTime(100);

    expect(sources).toHaveLength(2);
    expect(sources[1].url).toBe('http://localhost:8080/api/report-requests/request-1/events');
    subscription.unsubscribe();
    expect(sources[1].closed).toBe(true);
  });

  it('ignores duplicate or out-of-order SSE snapshots by persisted sequence', () => {
    const statuses: string[] = [];
    const subscription = service.watchRequest('request-1').subscribe((event) => {
      if (event.kind === 'update') statuses.push(event.request.status);
    });
    vi.advanceTimersByTime(0);
    http.expectOne('http://localhost:8080/api/report-requests/request-1').flush(
      reportRequest('ANALYZING_CONTENT'),
    );

    sources[0].emit(progressEvent('BUILDING_STRATEGY', false, 4));
    sources[0].emit(progressEvent('SELECTING_CONTENT', false, 3));
    sources[0].emit(progressEvent('BUILDING_STRATEGY', false, 4));

    expect(statuses).toEqual(['ANALYZING_CONTENT', 'BUILDING_STRATEGY']);
    subscription.unsubscribe();
  });

  it('reports a temporary error and resumes polling', () => {
    const eventKinds: string[] = [];
    const subscription = service
      .watchRequest('request-1')
      .subscribe((event) => eventKinds.push(event.kind));

    vi.advanceTimersByTime(0);
    http.expectOne('http://localhost:8080/api/report-requests/request-1').flush('Unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });
    vi.advanceTimersByTime(100);
    http.expectOne('http://localhost:8080/api/report-requests/request-1').flush(
      reportRequest('ANALYZING_CONTENT'),
    );

    expect(eventKinds).toEqual(['temporary-error', 'update']);
    subscription.unsubscribe();
  });

  it('turns an isolated GET failure into a controlled result and keeps polling', () => {
    const eventKinds: string[] = [];
    const subscription = service
      .watchRequest('missing')
      .subscribe((event) => eventKinds.push(event.kind));
    vi.advanceTimersByTime(0);
    http.expectOne('http://localhost:8080/api/report-requests/missing').flush('Missing', {
      status: 404,
      statusText: 'Not Found',
    });
    vi.advanceTimersByTime(100);
    http.expectOne('http://localhost:8080/api/report-requests/missing').flush({
      requestId: 'missing',
      status: 'QUEUED',
    });

    expect(eventKinds).toEqual(['temporary-error', 'update']);
    subscription.unsubscribe();
  });

  it('loads the completed report preview', () => {
    const detail = {
      id: '00000000-0000-4000-8000-000000000001',
      requestId: '00000000-0000-4000-8000-000000000002',
      platformAccountId: '00000000-0000-4000-8000-000000000003',
      platformCode: 'YOUTUBE',
      platformHandle: '@havk',
      channelId: '00000000-0000-4000-8000-000000000003',
      channelName: 'Canal HAVK',
      requestedTopic: null,
      title: 'Relatório pronto',
      summary: 'Resumo acionável.',
      dataCollectedAt: null,
      generatedAt: '2026-07-22T12:05:00Z',
      createdAt: '2026-07-22T12:05:01Z',
      ideas: [],
      sources: [],
    };
    const preview: ReportPreviewResponse = {
      id: detail.id,
      requestId: detail.requestId,
      platformAccountId: detail.platformAccountId,
      channelId: detail.channelId,
      title: detail.title,
      summary: detail.summary,
      generatedAt: detail.generatedAt,
    };
    let received: typeof preview | undefined;

    service.getReport(detail.id).subscribe((value) => (received = value));
    const request = http.expectOne(`http://localhost:8080/api/reports/${detail.id}`);
    expect(request.request.method).toBe('GET');
    request.flush(detail);

    expect(received).toEqual(preview);
  });

  it('contains an invalid polling response and retries only the GET', () => {
    const eventKinds: string[] = [];
    const subscription = service
      .watchRequest('request-1')
      .subscribe((event) => eventKinds.push(event.kind));
    vi.advanceTimersByTime(0);
    http.expectOne('http://localhost:8080/api/report-requests/request-1').flush({
      status: 'COMPLETED',
    });
    vi.advanceTimersByTime(100);
    http.expectOne('http://localhost:8080/api/report-requests/request-1').flush({
      requestId: 'request-1',
      status: 'ANALYZING_CONTENT',
    });

    expect(eventKinds).toEqual(['temporary-error', 'update']);
    subscription.unsubscribe();
  });
});

class FakeEventSource implements ReportEventSource {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  constructor(readonly url: string) {}
  emit(value: object): void { this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent<string>); }
  close(): void { this.closed = true; }
}
function progressEvent(status: ReportRequestResponse['status'], terminal = false, sequence = 2): object {
  return { requestId: 'request-1', sequence, status,
    progressPercent: terminal ? 100 : 50, message: 'Progresso',
    occurredAt: '2026-07-22T12:01:00Z', terminal, resultAvailable: terminal };
}

function reportRequest(
  status: ReportRequestResponse['status'],
  reportId: string | null = null,
): ReportRequestResponse {
  return {
    requestId: 'request-1',
    platformAccountId: 'account-1',
    channelId: 'channel-1',
    topic: null,
    objective: 'Produzir conteúdo útil',
    instructions: null,
    ideaCount: 5,
    methodology: 'HOOK_PROBLEM_SOLUTION_DIFFERENTIATOR',
    selectedTrendIds: [],
    reportVersion: 1,
    regeneratedFromReportId: null,
    status,
    processingStep: null,
    attemptCount: 1,
    nextAttemptAt: null,
    failureCategory: null,
    failureCode: null,
    failureMessage: null,
    reportId,
    createdAt: '2026-07-22T12:00:00Z',
    updatedAt: '2026-07-22T12:00:00Z',
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
  };
}
