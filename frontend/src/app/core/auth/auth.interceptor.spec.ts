import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

import { authInterceptor } from './auth.interceptor';
import { AuthSessionStore } from './auth-session.store';

describe('authInterceptor', () => {
  const navigate = vi.fn(() => Promise.resolve(true));
  const router = { url: '/conta', navigate };
  let client: HttpClient;
  let http: HttpTestingController;
  let document: Document;
  let store: AuthSessionStore;

  beforeEach(() => {
    navigate.mockClear();
    router.url = '/conta';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    document = TestBed.inject(DOCUMENT);
    store = TestBed.inject(AuthSessionStore);
    document.cookie = 'XSRF-TOKEN=csrf-value; path=/';
  });

  afterEach(() => http.verify());

  it('sends credentials and csrf headers on mutating requests', async () => {
    const response = firstValueFrom(client.post('/api/auth/login', {}));
    const request = http.expectOne('/api/auth/login');

    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-XSRF-TOKEN')).toBe('csrf-value');
    expect(request.request.headers.get('X-CSRF-TOKEN')).toBe('csrf-value');
    request.flush({});
    await response;
  });

  it('clears expired sessions and redirects a private page', async () => {
    router.url = '/relatorios/00000000-0000-4000-8000-000000000001?origem=historico';
    const response = firstValueFrom(client.get('/api/auth/me')).catch((error: unknown) => error);
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await response;
    await Promise.resolve();

    expect(store.session().status).toBe('anonymous');
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: {
        returnUrl: '/relatorios/00000000-0000-4000-8000-000000000001?origem=historico',
      },
    });
  });

  it('redirects only once when concurrent requests discover the expired session', async () => {
    router.url = '/relatorios';
    const first = firstValueFrom(client.get('/api/reports')).catch((error: unknown) => error);
    const second = firstValueFrom(client.get('/api/channel')).catch((error: unknown) => error);
    http.expectOne('/api/reports').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/channel').flush({}, { status: 401, statusText: 'Unauthorized' });
    await Promise.all([first, second]);
    await Promise.resolve();

    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
