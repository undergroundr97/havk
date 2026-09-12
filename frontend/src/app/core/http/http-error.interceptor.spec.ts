import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { ApiError } from './api-error.model';
import { httpErrorInterceptor } from './http-error.interceptor';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('preserves successful public responses', async () => {
    const response = firstValueFrom(http.get<{ readonly status: 'UP' }>('/api/health'));
    httpTesting.expectOne('/api/health').flush({ status: 'UP' });

    await expect(response).resolves.toEqual({ status: 'UP' });
  });

  it('preserves the typed backend error contract', async () => {
    const backendError: ApiError = {
      code: 'VALIDATION_ERROR',
      message: 'Os dados enviados são inválidos.',
      status: 400,
      timestamp: '2026-07-22T12:00:00Z',
      path: '/api/example',
      details: [],
    };
    const response = firstValueFrom(http.get('/api/example')).catch((error: unknown) => error);

    httpTesting
      .expectOne('/api/example')
      .flush(backendError, { status: 400, statusText: 'Bad Request' });

    const error = await response;
    expect(error).toBeInstanceOf(HttpErrorResponse);
    if (error instanceof HttpErrorResponse) {
      expect(error.error).toEqual(backendError);
    }
  });

  it('normalizes unstructured HTTP failures and keeps them as failures', async () => {
    const response = firstValueFrom(http.get('/api/example')).catch((error: unknown) => error);

    httpTesting
      .expectOne('/api/example')
      .flush('unexpected', { status: 503, statusText: 'Service Unavailable' });

    const error = await response;
    expect(error).toBeInstanceOf(HttpErrorResponse);
    if (error instanceof HttpErrorResponse) {
      expect(error.status).toBe(503);
      expect(error.error).toMatchObject({
        code: 'HTTP_ERROR',
        status: 503,
        path: '/api/example',
      });
    }
  });
});
