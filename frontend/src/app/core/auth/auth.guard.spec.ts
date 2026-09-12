import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';

import { AuthenticatedUser } from './auth.models';
import { authenticatedGuard, authenticatedUserRedirectGuard } from './auth.guard';
import { AuthSessionStore } from './auth-session.store';

describe('authenticatedGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/conta' } as RouterStateSnapshot;
  const user: AuthenticatedUser = {
    id: 'user-1',
    name: 'Criadora HAVK',
    email: 'creator@example.com',
    status: 'ACTIVE',
    createdAt: '2026-07-22T12:00:00Z',
    updatedAt: '2026-07-22T12:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(AuthSessionStore).anonymous();
  });

  it('returns a login UrlTree for anonymous users', () => {
    const result = TestBed.runInInjectionContext(() => authenticatedGuard(route, state));
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/login?returnUrl=%2Fconta',
    );
  });

  it('rejects an external return URL even when route state is malformed', () => {
    const unsafeState = { url: '//evil.example/report' } as RouterStateSnapshot;
    const result = TestBed.runInInjectionContext(() => authenticatedGuard(route, unsafeState));
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/login?returnUrl=%2Fdashboard',
    );
  });

  it('allows authenticated users', () => {
    TestBed.inject(AuthSessionStore).authenticated(user);

    expect(TestBed.runInInjectionContext(() => authenticatedGuard(route, state))).toBe(true);
  });

  it('waits for session restoration before deciding a private route', async () => {
    const store = TestBed.inject(AuthSessionStore);
    store.loading();
    const result = TestBed.runInInjectionContext(() => authenticatedGuard(route, state));
    const resolution = firstValueFrom(result as Observable<boolean>);
    store.authenticated(user);

    await expect(resolution).resolves.toBe(true);
  });

  it('redirects an authenticated visitor away from login without looping for anonymous users', () => {
    const router = TestBed.inject(Router);
    expect(TestBed.runInInjectionContext(() => authenticatedUserRedirectGuard(route, state))).toBe(true);

    TestBed.inject(AuthSessionStore).authenticated(user);
    const result = TestBed.runInInjectionContext(() => authenticatedUserRedirectGuard(route, state));
    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/dashboard');
  });

  it('waits for restoration before redirecting an authenticated login visit', async () => {
    const store = TestBed.inject(AuthSessionStore);
    const router = TestBed.inject(Router);
    store.loading();
    const result = TestBed.runInInjectionContext(() => authenticatedUserRedirectGuard(route, state));
    const resolution = firstValueFrom(result as Observable<ReturnType<Router['createUrlTree']>>);
    store.authenticated(user);

    expect(router.serializeUrl(await resolution)).toBe('/dashboard');
  });
});
