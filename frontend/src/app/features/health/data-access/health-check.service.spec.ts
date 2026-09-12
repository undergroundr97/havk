import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api-config';
import { HealthCheckService } from './health-check.service';

describe('HealthCheckService', () => {
  let httpTesting: HttpTestingController;
  let service: HealthCheckService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: 'https://api.example.test/' } },
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(HealthCheckService);
  });

  afterEach(() => httpTesting.verify());

  it('requests the typed public health endpoint', async () => {
    const response = firstValueFrom(service.check());
    const request = httpTesting.expectOne('https://api.example.test/api/health');

    expect(request.request.method).toBe('GET');
    request.flush({ status: 'UP' });

    await expect(response).resolves.toEqual({ status: 'UP' });
  });
});
