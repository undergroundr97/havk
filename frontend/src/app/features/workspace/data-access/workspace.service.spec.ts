import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_CONFIG } from '../../../core/config/api-config';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceService', () => {
  let http: HttpTestingController;
  let service: WorkspaceService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: 'http://api.test/' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(WorkspaceService);
  });

  afterEach(() => http.verify());

  it('lists authenticated conversations', () => {
    let title: string | undefined;
    service.list().subscribe((items) => (title = items[0]?.title));
    const request = http.expectOne('http://api.test/api/report-conversations');
    expect(request.request.method).toBe('GET');
    request.flush([summary]);
    expect(title).toBe('Conversa editorial');
  });

  it('loads a conversation feed through the typed parser', () => {
    let entryCount: number | undefined;
    service.detail(CONVERSATION_ID).subscribe((detail) => (entryCount = detail.entries.length));
    const request = http.expectOne(`http://api.test/api/report-conversations/${CONVERSATION_ID}`);
    expect(request.request.method).toBe('GET');
    request.flush({ conversation: summary, entries: [], requests: [], reports: [] });
    expect(entryCount).toBe(0);
  });

  it('accepts a valid HTTP 200 when optional aggregate arrays are absent', () => {
    let counts: readonly number[] | undefined;
    service.detail(CONVERSATION_ID).subscribe((detail) => {
      counts = [detail.entries.length, detail.requests.length, detail.reports.length];
    });
    http.expectOne(`http://api.test/api/report-conversations/${CONVERSATION_ID}`)
      .flush({ conversation: summary });

    expect(counts).toEqual([0, 0, 0]);
  });

  it('archives without expecting a response body', () => {
    let completed = false;
    service.archive(CONVERSATION_ID).subscribe(() => (completed = true));
    const request = http.expectOne(`http://api.test/api/report-conversations/${CONVERSATION_ID}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(completed).toBe(true);
  });

  it('sends one idempotent natural-language message to the workspace endpoint', () => {
    let conversationId: string | undefined;
    const payload = {
      messageId: '00000000-0000-4000-8000-000000000003',
      platformAccountId: summary.platformAccountId,
      conversationId: null,
      message: 'Quero criar um conteúdo sobre Spring Boot.',
      researchMode: 'SEARCH' as const,
    };
    service.sendMessage(payload).subscribe((response) => (conversationId = response.conversationId));
    const request = http.expectOne('http://api.test/api/workspace/messages');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush(messageResponse);
    expect(conversationId).toBe(CONVERSATION_ID);
  });
});

const CONVERSATION_ID = '00000000-0000-4000-8000-000000000001';
const summary = {
  id: CONVERSATION_ID,
  platformAccountId: '00000000-0000-4000-8000-000000000002',
  platformCode: 'YOUTUBE',
  accountDisplayName: 'Canal HAVK',
  accountHandle: '@havk',
  title: 'Conversa editorial',
  status: 'ACTIVE',
  hasActiveRequest: false,
  createdAt: '2026-07-29T12:00:00Z',
  updatedAt: '2026-07-29T12:05:00Z',
  archivedAt: null,
  researchMode: 'SEARCH',
};
const messageResponse = {
  messageId: '00000000-0000-4000-8000-000000000003',
  conversationId: CONVERSATION_ID,
  requestId: '00000000-0000-4000-8000-000000000004',
  clarificationRequired: false,
  clarificationQuestion: null,
  interpretation: {
    generationMode: 'USER_DIRECTED',
    subject: 'Spring Boot',
    objective: 'Ensinar automação',
    additionalInstructions: null,
    useCurrentTrends: false,
    automaticDiscovery: false,
    confidence: .9,
    clarificationRequired: false,
    clarificationQuestion: null,
    interpretedLanguage: 'pt-BR',
    providerReference: 'fake-workspace-message-interpretation',
    modelReference: 'deterministic-rules-v1',
    simulated: true,
  },
  researchMode: 'SEARCH',
  outcome: 'RESEARCH_STARTED',
  assistantMessage: 'Pesquisa iniciada.',
};
