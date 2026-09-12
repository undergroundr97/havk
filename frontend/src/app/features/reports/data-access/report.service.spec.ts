import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_CONFIG } from '../../../core/config/api-config';
import { ApiError } from '../../../core/http/api-error.model';
import {
  ReportDetailResponse,
  ReportRegenerationResponse,
  ReportSummaryResponse,
} from './report.models';
import { InvalidReportResponseError } from './report-response.parser';
import { ReportService } from './report.service';

describe('ReportService', () => {
  let http: HttpTestingController;
  let service: ReportService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: 'http://api.test/' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ReportService);
  });

  afterEach(() => http.verify());

  it('loads and validates a paginated report summary', () => {
    let received: ReportSummaryResponse | undefined;

    service.listReports(1, 1).subscribe((page) => (received = page.content[0]));

    const request = http.expectOne('http://api.test/api/reports?page=1&size=1');
    expect(request.request.method).toBe('GET');
    request.flush({
      content: [reportSummary],
      page: 1,
      size: 1,
      totalElements: 2,
      totalPages: 2,
      first: false,
      last: true,
    });

    expect(received).toMatchObject(reportSummary);
  });

  it('accepts an empty page and a nullable requested topic', () => {
    const { requestedTopic: _requestedTopic, ...summaryWithoutTopic } = reportSummary;
    let receivedTopic: string | null | undefined;
    service.listReports().subscribe((page) => {
      receivedTopic = page.content[0]?.requestedTopic;
    });

    http.expectOne('http://api.test/api/reports?page=0&size=20').flush({
      content: [summaryWithoutTopic],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    });
    expect(receivedTopic).toBeNull();

    let emptyCount: number | undefined;
    service.listReports().subscribe((page) => (emptyCount = page.content.length));
    http.expectOne('http://api.test/api/reports?page=0&size=20').flush({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      first: true,
      last: true,
    });
    expect(emptyCount).toBe(0);
  });

  it('rejects a summary missing a roadmap field', () => {
    let receivedError: unknown;
    const { channelName: _channelName, ...invalidSummary } = reportSummary;

    service.listReports().subscribe({ error: (error: unknown) => (receivedError = error) });
    http.expectOne('http://api.test/api/reports?page=0&size=20').flush({
      content: [invalidSummary],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    });

    expect(receivedError).toBeInstanceOf(InvalidReportResponseError);
  });

  it('rejects inconsistent pagination metadata', () => {
    let receivedError: unknown;

    service.listReports(0, 1).subscribe({ error: (error: unknown) => (receivedError = error) });
    http.expectOne('http://api.test/api/reports?page=0&size=1').flush({
      content: [reportSummary],
      page: 0,
      size: 1,
      totalElements: 2,
      totalPages: 1,
      first: true,
      last: true,
    });

    expect(receivedError).toBeInstanceOf(InvalidReportResponseError);
  });

  it('loads and validates the complete report contract', () => {
    let received: ReportDetailResponse | undefined;

    service.getReport(REPORT_ID).subscribe((report) => (received = report));
    const request = http.expectOne(`http://api.test/api/reports/${REPORT_ID}`);
    expect(request.request.method).toBe('GET');
    request.flush(reportDetail);

    expect(received).toMatchObject(reportDetail);
  });

  it('accepts nullable detail fields and empty collections', () => {
    const minimalDetail: ReportDetailResponse = {
      ...reportDetail,
      dataCollectedAt: null,
      ideas: [],
      sources: [],
    };
    let received: ReportDetailResponse | undefined;

    service.getReport(REPORT_ID).subscribe((report) => (received = report));
    http.expectOne(`http://api.test/api/reports/${REPORT_ID}`).flush(minimalDetail);

    expect(received).toMatchObject(minimalDetail);
  });

  it('rejects duplicate idea positions', () => {
    let receivedError: unknown;
    service.getReport(REPORT_ID).subscribe({ error: (error: unknown) => (receivedError = error) });

    http.expectOne(`http://api.test/api/reports/${REPORT_ID}`).flush({
      ...reportDetail,
      ideas: [
        reportDetail.ideas[0],
        { ...reportDetail.ideas[0], id: SECOND_ID },
      ],
      sources: [],
    });

    expect(receivedError).toBeInstanceOf(InvalidReportResponseError);
  });

  it('rejects invalid dates and sources associated with an unknown idea', () => {
    let invalidDateError: unknown;
    service.getReport(REPORT_ID).subscribe({
      error: (error: unknown) => (invalidDateError = error),
    });
    http.expectOne(`http://api.test/api/reports/${REPORT_ID}`).flush({
      ...reportDetail,
      generatedAt: 'not-an-instant',
    });
    expect(invalidDateError).toBeInstanceOf(InvalidReportResponseError);

    let invalidSourceError: unknown;
    service.getReport(REPORT_ID).subscribe({
      error: (error: unknown) => (invalidSourceError = error),
    });
    http.expectOne(`http://api.test/api/reports/${REPORT_ID}`).flush({
      ...reportDetail,
      sources: [{ ...reportDetail.sources[0], videoIdeaId: SECOND_ID }],
    });
    expect(invalidSourceError).toBeInstanceOf(InvalidReportResponseError);
  });

  it('preserves a standardized API error', () => {
    let receivedError: unknown;
    service.getReport(REPORT_ID).subscribe({ error: (error: unknown) => (receivedError = error) });

    http.expectOne(`http://api.test/api/reports/${REPORT_ID}`).flush(apiError, {
      status: 404,
      statusText: 'Not Found',
    });

    expect(receivedError).toBeInstanceOf(HttpErrorResponse);
    if (!(receivedError instanceof HttpErrorResponse)) {
      throw new Error('Expected HttpErrorResponse.');
    }
    expect(receivedError.error).toEqual(apiError);
  });

  it('uses the existing DELETE contract without expecting a response body', () => {
    let completed = false;
    service.deleteReport(REPORT_ID).subscribe(() => (completed = true));

    const request = http.expectOne(`http://api.test/api/reports/${REPORT_ID}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('requests regeneration as a new report version', () => {
    const response: ReportRegenerationResponse = { requestId: REQUEST_ID };
    let received: ReportRegenerationResponse | undefined;

    service.regenerateReport(REPORT_ID).subscribe((result) => (received = result));

    const request = http.expectOne(`http://api.test/api/reports/${REPORT_ID}/regenerations`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ additionalInstructions: null });
    request.flush(response, { status: 202, statusText: 'Accepted' });

    expect(received).toEqual(response);
  });
});

const REPORT_ID = '00000000-0000-4000-8000-000000000001';
const REQUEST_ID = '00000000-0000-4000-8000-000000000002';
const CHANNEL_ID = '00000000-0000-4000-8000-000000000003';
const IDEA_ID = '00000000-0000-4000-8000-000000000004';
const SOURCE_ID = '00000000-0000-4000-8000-000000000005';
const SECOND_ID = '00000000-0000-4000-8000-000000000006';

const reportSummary: ReportSummaryResponse = {
  id: REPORT_ID,
  requestId: REQUEST_ID,
  platformAccountId: CHANNEL_ID,
  platformCode: 'YOUTUBE',
  platformHandle: '@havk',
  channelId: CHANNEL_ID,
  title: 'Relatório pronto',
  summary: 'Resumo acionável.',
  generatedAt: '2026-07-22T12:05:00Z',
  createdAt: '2026-07-22T12:05:01Z',
  channelName: 'Canal HAVK',
  requestedTopic: 'Angular Signals',
  requestedIdeaCount: 2,
  status: 'COMPLETED',
};

const reportDetail: ReportDetailResponse = {
  id: REPORT_ID,
  requestId: REQUEST_ID,
  platformAccountId: CHANNEL_ID,
  platformCode: 'YOUTUBE',
  platformHandle: '@havk',
  channelId: CHANNEL_ID,
  channelName: 'Canal HAVK',
  requestedTopic: 'Angular Signals',
  title: 'Relatório pronto',
  summary: 'Resumo acionável.',
  dataCollectedAt: '2026-07-22T12:04:00Z',
  generatedAt: '2026-07-22T12:05:00Z',
  createdAt: '2026-07-22T12:05:01Z',
  ideas: [
    {
      id: IDEA_ID,
      position: 0,
      provisionalTitle: 'Signals sem mistério',
      summary: 'Uma introdução prática.',
      relatedTrend: 'Angular Signals',
      compatibilityJustification: 'Compatível com o público do canal.',
      hook: 'Pare de sincronizar estado manualmente.',
      problem: 'Estado duplicado aumenta a complexidade.',
      solution: 'Use uma fonte de verdade reativa.',
      differentiator: 'Exemplos pequenos e verificáveis.',
      targetAudience: 'Desenvolvedores Angular',
      notes: 'Validar exemplos na versão 22.',
      relevanceLevel: null,
      competitionLevel: 'MEDIUM',
      urgencyLevel: null,
      keywords: ['angular', 'signals'],
      risks: [],
      limitations: ['Conteúdo introdutório'],
    },
  ],
  sources: [
    {
      id: SOURCE_ID,
      videoIdeaId: IDEA_ID,
      position: 0,
      sourceType: 'DOCUMENTATION',
      sourceName: 'Angular',
      title: 'Signals',
      reference: 'https://angular.dev/guide/signals',
      publisher: null,
      publishedAt: null,
      collectedAt: '2026-07-22T12:04:00Z',
    },
  ],
};

const apiError: ApiError = {
  code: 'REPORT_NOT_FOUND',
  message: 'Relatório não encontrado.',
  status: 404,
  timestamp: '2026-07-22T12:06:00Z',
  path: `/api/reports/${REPORT_ID}`,
  details: [],
};
