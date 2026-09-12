import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { routes } from './app.routes';
import { HealthCheckService } from './features/health/data-access/health-check.service';
import { AuthService } from './core/auth/auth.service';
import { authenticatedGuard, authenticatedUserRedirectGuard } from './core/auth/auth.guard';
import { AuthSessionStore } from './core/auth/auth-session.store';

describe('application routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: HealthCheckService,
          useValue: { check: () => of({ status: 'UP' as const }) },
        },
        { provide: AuthService, useValue: { logout: () => Promise.resolve() } },
      ],
    });
  });

  it('loads the public home page', async () => {
    const harness = await RouterTestingHarness.create('/');

    expect(harness.routeNativeElement?.textContent).toContain(
      'Transforme sinais do seu canal em ideias que fazem sentido.',
    );
  });

  it('redirects unknown paths to the generic error page', async () => {
    const harness = await RouterTestingHarness.create('/endereco-inexistente');
    const router = TestBed.inject(Router);

    expect(router.url).toBe('/erro');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Esta ideia ainda não ganhou uma página.',
    );
  });

  it('protects private routes with the functional guard', () => {
    const privateShell = routes[1];
    const childRoutes = privateShell?.children ?? [];
    const dashboard = childRoutes.find((route) => route.path === 'dashboard');
    const onboarding = childRoutes.find((route) => route.path === 'perfil/onboarding');
    const edit = childRoutes.find((route) => route.path === 'perfil');
    const channel = childRoutes.find((route) => route.path === 'canal');
    const channelCreate = childRoutes.find((route) => route.path === 'canal/novo');
    const channelEdit = childRoutes.find((route) => route.path === 'canal/editar');
    const reportGeneration = childRoutes.find((route) => route.path === 'relatorios/novo');
    const trends = childRoutes.find((route) => route.path === 'tendencias');
    const reportHistory = childRoutes.find((route) => route.path === 'relatorios');
    const reportDetail = childRoutes.find((route) => route.path === 'relatorios/:reportId');

    expect(privateShell?.canActivateChild).toEqual([authenticatedGuard]);
    expect(dashboard?.canActivate).toEqual([authenticatedGuard]);
    expect(dashboard?.loadComponent).toBeTypeOf('function');
    expect(onboarding?.canActivate).toEqual([authenticatedGuard]);
    expect(edit?.canActivate).toEqual([authenticatedGuard]);
    expect(channel?.canActivate).toEqual([authenticatedGuard]);
    expect(channelCreate?.canActivate).toEqual([authenticatedGuard]);
    expect(channelEdit?.canActivate).toEqual([authenticatedGuard]);
    expect(reportGeneration?.canActivate).toEqual([authenticatedGuard]);
    expect(trends?.canActivate).toEqual([authenticatedGuard]);
    expect(trends?.loadComponent).toBeTypeOf('function');
    expect(reportHistory?.canActivate).toEqual([authenticatedGuard]);
    expect(reportHistory?.loadComponent).toBeTypeOf('function');
    expect(reportDetail?.canActivate).toEqual([authenticatedGuard]);
    expect(reportDetail?.loadComponent).toBeTypeOf('function');
  });

  it('keeps login in the public shell and applies the authenticated-user redirect guard', () => {
    const publicShell = routes[0];
    const login = publicShell?.children?.find((route) => route.path === 'login');

    expect(publicShell?.loadComponent).toBeTypeOf('function');
    expect(login?.canActivate).toEqual([authenticatedUserRedirectGuard]);
    expect((routes[1]?.children ?? []).some((route) => route.path === 'login')).toBe(false);
  });

  it('renders login without the authenticated sidebar for an anonymous session', async () => {
    TestBed.inject(AuthSessionStore).anonymous();
    const harness = await RouterTestingHarness.create('/login');

    expect(harness.fixture.nativeElement.querySelector('app-public-layout')).not.toBeNull();
    expect(harness.fixture.nativeElement.querySelector('.sidebar')).toBeNull();
    expect(harness.fixture.nativeElement.textContent).toContain('Entrar');
  });
});
