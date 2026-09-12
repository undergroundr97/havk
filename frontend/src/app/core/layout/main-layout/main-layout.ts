import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { AuthSessionStore } from '../../auth/auth-session.store';
import { ReportSummaryResponse } from '../../../features/reports/data-access/report.models';
import { ReportService } from '../../../features/reports/data-access/report.service';
import { formatReportDate } from '../../../features/report-viewer/report-date';

type RecentReportsStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

interface RecentReportsState {
  readonly status: RecentReportsStatus;
  readonly reports: readonly ReportSummaryResponse[];
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly reportService = inject(ReportService);
  private readonly router = inject(Router);
  private readonly mainContent = viewChild<ElementRef<HTMLElement>>('mainContent');
  private readonly drawer = viewChild<ElementRef<HTMLElement>>('drawer');
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ),
    { initialValue: null },
  );
  protected readonly session = inject(AuthSessionStore);
  protected readonly menuOpen = signal(false);
  protected readonly recentReportsState = signal<RecentReportsState>({
    status: 'idle',
    reports: [],
  });
  protected readonly formatReportDate = formatReportDate;
  private readonly currentPath = computed(
    () => (this.navigationEnd()?.urlAfterRedirects ?? this.router.url).split(/[?#]/, 1)[0] || '/',
  );
  protected readonly profileCurrent = computed(() => this.currentPath().startsWith('/perfil'));
  protected readonly generationCurrent = computed(() => {
    const path = this.currentPath();
    return path === '/relatorios/novo' || path === '/workspace' || path.startsWith('/workspace/');
  });
  protected readonly reportsCurrent = computed(() => {
    const path = this.currentPath();
    return path === '/relatorios' || (path.startsWith('/relatorios/') && path !== '/relatorios/novo');
  });

  private readonly focusMainAfterNavigation = effect(() => {
    if (this.navigationEnd()) {
      this.menuOpen.set(false);
      queueMicrotask(() => this.mainContent()?.nativeElement.focus());
    }
  });

  private readonly lockPageBehindDrawer = effect((onCleanup) => {
    if (!this.menuOpen()) return;
    const previousOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    onCleanup(() => (this.document.body.style.overflow = previousOverflow));
  });

  ngOnInit(): void {
    this.loadRecentReports();
  }

  protected openMenu(): void {
    this.menuOpen.set(true);
    queueMicrotask(() => this.focusableDrawerElements()[0]?.focus());
  }

  protected closeMenu(restoreFocus = true): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    if (restoreFocus) queueMicrotask(() => this.menuButton()?.nativeElement.focus());
  }

  protected closeMenuForNavigation(): void {
    this.menuOpen.set(false);
    queueMicrotask(() => this.mainContent()?.nativeElement.focus());
  }

  protected reloadRecentReports(): void {
    this.loadRecentReports();
  }

  protected handleDrawerKeydown(event: KeyboardEvent): void {
    if (!this.menuOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = this.focusableDrawerElements();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!this.drawer()?.nativeElement.contains(this.document.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }

  protected async logout(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigateByUrl('/login');
    }
  }

  private loadRecentReports(): void {
    const currentState = this.recentReportsState();
    if (currentState.status === 'loading') return;

    this.recentReportsState.set({ status: 'loading', reports: currentState.reports });
    this.reportService
      .listReports(0, 5)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          const reports = page.content.slice(0, 5);
          this.recentReportsState.set({
            status: reports.length === 0 ? 'empty' : 'success',
            reports,
          });
        },
        error: () => {
          this.recentReportsState.update((state) => ({ ...state, status: 'error' }));
        },
      });
  }

  private focusableDrawerElements(): readonly HTMLElement[] {
    return Array.from(
      this.drawer()?.nativeElement.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
    );
  }
}
