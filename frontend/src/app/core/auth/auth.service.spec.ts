import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { API_CONFIG } from '../config/api-config';
import { AuthenticatedUser } from './auth.models';
import { AuthService } from './auth.service';
import { AuthSessionStore } from './auth-session.store';

describe('AuthService', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    name: 'Criadora HAVK',
    email: 'creator@example.com',
    status: 'ACTIVE',
    createdAt: '2026-07-22T12:00:00Z',
    updatedAt: '2026-07-22T12:00:00Z',
  };
  let service: AuthService;
  let http: HttpTestingController;
  let store: AuthSessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: '/backend' } },
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthSessionStore);
  });

  afterEach(() => http.verify());

  it('restores the authenticated user through csrf and me', async () => {
    const restoration = service.restoreSession();
    http.expectOne('/backend/api/auth/csrf').flush({
      headerName: 'X-XSRF-TOKEN',
      token: 'csrf-token',
    });
    (await waitForRequest('/backend/api/auth/me')).flush(user);
    await restoration;

    expect(store.user()).toEqual(user);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('treats an unauthenticated me response as an anonymous session', async () => {
    const restoration = service.restoreSession();
    http.expectOne('/backend/api/auth/csrf').flush({
      headerName: 'X-XSRF-TOKEN',
      token: 'csrf-token',
    });
    (await waitForRequest('/backend/api/auth/me')).flush(
      {},
      { status: 401, statusText: 'Unauthorized' },
    );
    await restoration;

    expect(store.session().status).toBe('anonymous');
  });

  it('retries a transient unauthenticated response while completing OAuth', async () => {
    const restoration = service.restoreOAuthSession(2, 0);
    http.expectOne('/backend/api/auth/csrf').flush({
      headerName: 'X-XSRF-TOKEN',
      token: 'csrf-token',
    });
    (await waitForRequest('/backend/api/auth/me')).flush(
      {},
      { status: 401, statusText: 'Unauthorized' },
    );
    (await waitForRequest('/backend/api/auth/me')).flush(user);

    await expect(restoration).resolves.toBe(true);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('logs in, refreshes csrf and publishes the user', async () => {
    const login = service.login({ email: user.email, password: 'long-secure-password' });
    http.expectOne('/backend/api/auth/csrf').flush({
      headerName: 'X-XSRF-TOKEN',
      token: 'before-login',
    });
    (await waitForRequest('/backend/api/auth/login')).flush(user);
    (await waitForRequest('/backend/api/auth/csrf')).flush({
      headerName: 'X-XSRF-TOKEN',
      token: 'after-login',
    });
    await login;

    expect(store.user()).toEqual(user);
  });

  it('logs out through the backend and clears the session', async () => {
    store.authenticated(user);
    const logout = service.logout();
    http.expectOne('/backend/api/auth/csrf').flush({
      headerName: 'X-XSRF-TOKEN',
      token: 'csrf-token',
    });
    (await waitForRequest('/backend/api/auth/logout')).flush(null);
    await logout;

    expect(store.session().status).toBe('anonymous');
  });

  it('starts Google authorization through a CSRF-protected backend request', async () => {
    const authorization = service.startGoogleLogin('/canal');
    http.expectOne('/backend/api/auth/csrf').flush({ headerName: 'X-XSRF-TOKEN', token: 'csrf-token' });
    const pending = await waitForRequest('/backend/api/auth/google/authorize');
    expect(pending.request.method).toBe('POST');
    expect(pending.request.body).toEqual({ returnUrl: '/canal', replaceManualChannel: false });
    pending.flush({ authorizationUrl: '/api/youtube/oauth/fake/authorize?state=opaque', expiresAt: '2026-07-28T12:10:00Z' });
    await expect(authorization).resolves.toBe('/backend/api/youtube/oauth/fake/authorize?state=opaque');
  });

  async function waitForRequest(url: string): Promise<TestRequest> {
    let request: TestRequest | undefined;
    await vi.waitFor(() => {
      const matches = http.match(url);
      expect(matches).toHaveLength(1);
      request = matches[0];
    });
    if (!request) throw new Error(`Request not found: ${url}`);
    return request;
  }
});
