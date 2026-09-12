import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_CONFIG } from '../../../core/config/api-config';
import { TrendService } from './trend.service';

describe('TrendService niche latest endpoints', () => {
  let service: TrendService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: API_CONFIG, useValue: { baseUrl: 'http://api.test/' } },
    ] });
    service = TestBed.inject(TrendService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads the latest persisted collection for the account', () => {
    service.latestCollectedSnapshots('account-1').subscribe();
    const request = http.expectOne('http://api.test/api/platform-accounts/account-1/youtube-niche-collections/latest');
    expect(request.request.method).toBe('GET'); request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('loads the latest deterministic ranking for the account', () => {
    service.latestYouTubeRanking('account-1').subscribe();
    const request = http.expectOne('http://api.test/api/platform-accounts/account-1/youtube-niche-rankings/latest');
    expect(request.request.method).toBe('GET'); request.flush({});
  });
});
