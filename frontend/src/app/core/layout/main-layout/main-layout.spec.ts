import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../auth/auth.service';
import { AuthenticatedUser } from '../../auth/auth.models';
import { AuthSessionStore } from '../../auth/auth-session.store';
import { ReportSummaryResponse } from '../../../features/reports/data-access/report.models';
import { ReportService } from '../../../features/reports/data-access/report.service';
import { MainLayout } from './main-layout';

@Component({ template: '<p>Conteúdo privado</p>' })
class RouteStub {}

describe('MainLayout', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideRouter([
          { path: 'dashboard', component: RouteStub },
          { path: 'perfil', component: RouteStub },
          { path: 'relatorios/novo', component: RouteStub },
          { path: 'relatorios/:reportId', component: RouteStub },
          { path: 'relatorios', component: RouteStub },
        ]),
        { provide: AuthService, useValue: { logout: vi.fn(() => Promise.resolve()) } },
        {
          provide: ReportService,
          useValue: {
            listReports: vi.fn(() =>
              of({
                content: [],
                page: 0,
                size: 5,
                totalElements: 0,
                totalPages: 0,
                first: true,
                last: true,
              }),
            ),
          },
        },
      ],
    });
  });

  it('renders the authenticated shell independently from public routes', () => {
    const fixture = TestBed.createComponent(MainLayout);
    fixture.detectChanges();
    expect(reportLink(fixture.nativeElement)?.textContent).toContain('Relatórios');
    expect(reportLink(fixture.nativeElement)?.getAttribute('href')).toBe('/relatorios');
    expect(fixture.nativeElement.querySelector('a[href="/workspace"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/perfil"]')?.textContent).toContain('Perfil');
    expect(fixture.nativeElement.querySelector('.sidebar a[href="/dashboard"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sidebar-account button')?.textContent).toContain('Sair');
  });

  it('keeps the five latest reports visible without requiring a dropdown interaction', () => {
    const listReports = vi.fn(() =>
      of({
        content: recentReports,
        page: 0,
        size: 5,
        totalElements: 5,
        totalPages: 1,
        first: true,
        last: true,
      }),
    );
    TestBed.overrideProvider(ReportService, { useValue: { listReports } });

    const fixture = TestBed.createComponent(MainLayout);
    fixture.detectChanges();

    const links = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
      '.recent-report-link',
    );
    expect(listReports).toHaveBeenCalledWith(0, 5);
    expect(links).toHaveLength(5);
    expect(links[0]?.textContent).toContain('Relatório 1');
    expect(links[4]?.getAttribute('href')).toBe('/relatorios/report-5');
    expect(fixture.nativeElement.querySelector('.nav-dropdown-trigger')).toBeNull();
  });

  it('opens the mobile drawer, traps keyboard focus and restores it after Escape', async () => {
    TestBed.inject(AuthSessionStore).authenticated(user);
    const fixture = TestBed.createComponent(MainLayout);
    fixture.detectChanges();
    const toggle = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.menu-button');
    if (!toggle) throw new Error('Menu button not found.');

    toggle.click();
    fixture.detectChanges();
    await Promise.resolve();
    const drawer = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.sidebar');
    const logout = drawer?.querySelector<HTMLButtonElement>('.sidebar-account button');
    expect(drawer?.classList.contains('is-open')).toBe(true);
    expect(drawer?.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');

    logout?.focus();
    drawer?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(drawer?.querySelector('a[href="/dashboard"]'));

    drawer?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await Promise.resolve();
    expect(drawer?.classList.contains('is-open')).toBe(false);
    expect(document.activeElement).toBe(toggle);
    expect(document.body.style.overflow).toBe('');
  });

  it('closes the mobile drawer after selecting an item and focuses the destination', async () => {
    TestBed.inject(AuthSessionStore).authenticated(user);
    const fixture = TestBed.createComponent(MainLayout);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.menu-button')?.click();
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.sidebar a[href="/dashboard"]:not(.sidebar-brand)',
    )?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();

    expect((fixture.nativeElement as HTMLElement).querySelector('.sidebar')?.classList.contains('is-open')).toBe(false);
    expect(document.activeElement).toBe(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('#main-content'),
    );
  });

  it('marks the reports journey as current and moves focus to main after navigation', async () => {
    TestBed.inject(AuthSessionStore).authenticated(user);
    const fixture = TestBed.createComponent(MainLayout);
    fixture.detectChanges();

    await TestBed.inject(Router).navigateByUrl(
      '/relatorios/00000000-0000-4000-8000-000000000001',
    );
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();

    expect(reportLink(fixture.nativeElement)?.getAttribute('aria-current')).toBe('page');
    expect(document.activeElement).toBe(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('#main-content'),
    );
  });

  it('logs out to the public login route', async () => {
    TestBed.inject(AuthSessionStore).authenticated(user);
    const auth = TestBed.inject(AuthService) as unknown as { logout: ReturnType<typeof vi.fn> };
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(MainLayout);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.sidebar-account button')?.click();
    await fixture.whenStable();

    expect(auth.logout).toHaveBeenCalledOnce();
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
  });
});

function reportLink(element: HTMLElement): HTMLAnchorElement | null {
  return element.querySelector<HTMLAnchorElement>('.reports-history-link');
}

const recentReports: readonly ReportSummaryResponse[] = Array.from({ length: 5 }, (_, index) => ({
  id: `report-${index + 1}`,
  requestId: `request-${index + 1}`,
  platformAccountId: 'account-1',
  platformCode: 'YOUTUBE',
  platformHandle: '@havk',
  channelId: 'channel-1',
  title: `Relatório ${index + 1}`,
  summary: 'Resumo do relatório.',
  generatedAt: `2026-08-${String(19 - index).padStart(2, '0')}T12:00:00Z`,
  createdAt: `2026-08-${String(19 - index).padStart(2, '0')}T12:00:00Z`,
  channelName: 'Canal HAVK',
  requestedTopic: null,
  requestedIdeaCount: 3,
  status: 'COMPLETED',
}));

const user: AuthenticatedUser = {
  id: 'user-1',
  name: 'Criadora HAVK',
  email: 'creator@example.com',
  status: 'ACTIVE',
  createdAt: '2026-07-22T12:00:00Z',
  updatedAt: '2026-07-22T12:00:00Z',
};
