import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_CONFIG } from '../../../core/config/api-config';
import { ContentMemoryService } from './content-memory.service';

describe('ContentMemoryService', () => {
  let http: HttpTestingController;
  let service: ContentMemoryService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: API_CONFIG, useValue: { baseUrl: 'http://api.test/' } }] });
    http = TestBed.inject(HttpTestingController); service = TestBed.inject(ContentMemoryService);
  });
  afterEach(() => http.verify());

  it('lists only the selected account content memory', () => {
    service.list('account id', 1, 10).subscribe();
    const request = http.expectOne('http://api.test/api/platform-accounts/account%20id/content-items?page=1&size=10');
    expect(request.request.method).toBe('GET');
    request.flush({ items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
  });

  it('sends creator text without an audio payload', () => {
    service.addTranscript('account', 'content', { transcriptText: 'Texto publicado', language: 'pt-BR', partial: false }).subscribe();
    const request = http.expectOne('http://api.test/api/platform-accounts/account/content-items/content/transcripts');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ transcriptText: 'Texto publicado', language: 'pt-BR', partial: false });
    expect(request.request.body).not.toHaveProperty('audio');
    request.flush({});
  });

  it('requests analysis for one content item', () => {
    service.analyze('account', 'content').subscribe();
    const request = http.expectOne('http://api.test/api/platform-accounts/account/content-items/content/analysis');
    expect(request.request.method).toBe('POST'); expect(request.request.body).toEqual({});
    request.flush({});
  });
});
