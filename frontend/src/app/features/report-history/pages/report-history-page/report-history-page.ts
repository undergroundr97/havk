import { HttpErrorResponse } from '@angular/common/http';
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map, Subscription } from 'rxjs';

import { isApiError } from '../../../../core/http/api-error.model';
import {
  PageResponse,
  ReportSummaryResponse,
} from '../../../reports/data-access/report.models';
import {
  reportDeletionFailure,
  ReportDeletionFailure,
} from '../../../reports/data-access/report-deletion-error';
import { InvalidReportResponseError } from '../../../reports/data-access/report-response.parser';
import { ReportService } from '../../../reports/data-access/report.service';
import { ReportDeleteDialog } from '../../../reports/components/report-delete-dialog/report-delete-dialog';
import { ReportHistoryItem } from '../../components/report-history-item/report-history-item';
import { PlatformAccountSelector } from '../../../platform-accounts/components/platform-account-selector/platform-account-selector';
import { PlatformAccountContextStore } from '../../../platform-accounts/data-access/platform-account-context.store';

const PAGE_SIZE = 20;

type HistoryErrorKind =
  | 'invalid-pagination'
  | 'session'
  | 'forbidden'
  | 'network'
  | 'invalid-response'
  | 'unknown';

type ReportHistoryViewState =
  | { readonly status: 'idle'; readonly page: null }
  | {
      readonly status: 'loading';
      readonly page: PageResponse<ReportSummaryResponse> | null;
      readonly requestedPage: number;
    }
  | {
      readonly status: 'success' | 'empty';
      readonly page: PageResponse<ReportSummaryResponse>;
    }
  | {
      readonly status: 'error';
      readonly page: PageResponse<ReportSummaryResponse> | null;
      readonly requestedPage: number;
      readonly kind: HistoryErrorKind;
      readonly message: string;
      readonly canRetry: boolean;
    };

type HistoryDeletionState =
  | { readonly status: 'idle' }
  | { readonly status: 'confirming' | 'deleting'; readonly report: ReportSummaryResponse }
  | {
      readonly status: 'error';
      readonly report: ReportSummaryResponse;
      readonly failure: ReportDeletionFailure;
    };

@Component({
  selector: 'app-report-history-page',
  standalone: true,
  imports: [RouterLink, ReportHistoryItem, ReportDeleteDialog, PlatformAccountSelector],
  templateUrl: './report-history-page.html',
  styleUrl: './report-history-page.scss',
})
export class ReportHistoryPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reportService = inject(ReportService);
  protected readonly accountContext = inject(PlatformAccountContextStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageHeading = viewChild<ElementRef<HTMLHeadingElement>>('pageHeading');
  private loadSubscription: Subscription | null = null;
  private loadingPage: number | null = null;

  protected readonly state = signal<ReportHistoryViewState>({ status: 'idle', page: null });
  protected readonly deletionState = signal<HistoryDeletionState>({ status: 'idle' });
  protected readonly deletionAnnouncement = signal<string | null>(null);
  protected readonly platformFilter = signal<string | null>(null);
  protected readonly platformOptions = computed(() =>
    [...new Map(this.accountContext.accounts().map((account) =>
      [account.platformCode, account.platformName] as const)).entries()]);
  protected readonly page = computed(() => this.state().page);
  protected readonly error = computed(() => {
    const current = this.state();
    return current.status === 'error' ? current : null;
  });
  protected readonly isLoading = computed(() => this.state().status === 'loading');
  protected readonly loadingPageNumber = computed(() => {
    const current = this.state();
    return current.status === 'loading' ? current.requestedPage + 1 : null;
  });
  protected readonly errorTitle = computed(() => {
    const current = this.error();
    switch (current?.kind) {
      case 'invalid-pagination':
        return 'Página inválida';
      case 'session':
        return 'Sessão inválida';
      case 'forbidden':
        return 'Acesso não permitido';
      case 'invalid-response':
        return 'Dados inválidos';
      default:
        return 'Erro ao carregar o histórico';
    }
  });
  protected readonly selectedReport = computed(() => {
    const current = this.deletionState();
    return current.status === 'idle' ? null : current.report;
  });
  protected readonly deletionError = computed(() => {
    const current = this.deletionState();
    return current.status === 'error' ? current.failure : null;
  });

  private readonly focusCompletedState = effect(() => {
    const status = this.state().status;
    const heading = this.pageHeading();
    if (status !== 'idle' && status !== 'loading' && heading) {
      heading.nativeElement.focus();
    }
  });

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(
        map((params) => {
          const deletionResult = params.get('exclusao');
          if (deletionResult === 'concluida') {
            this.deletionAnnouncement.set('Relatório excluído com sucesso.');
          } else if (deletionResult === 'ausente') {
            this.deletionAnnouncement.set(
              'O relatório já não estava disponível e o histórico foi atualizado.',
            );
          }
          return params.get('pagina');
        }),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((pageParameter) => {
        const pageIndex = parsePageIndex(pageParameter);
        if (pageIndex === null) {
          this.loadSubscription?.unsubscribe();
          this.loadSubscription = null;
          this.loadingPage = null;
          this.setError(
            'invalid-pagination',
            'Use um número de página inteiro e maior que zero.',
            false,
            0,
          );
          return;
        }
        this.loadPage(pageIndex);
      });
  }

  protected retry(): void {
    const current = this.state();
    if (current.status === 'error' && current.canRetry && this.loadingPage === null) {
      this.loadPage(current.requestedPage);
    }
  }

  protected goToFirstPage(): void {
    this.navigateToPage(0);
  }

  protected goToPreviousPage(): void {
    const page = this.page();
    if (page && page.page > 0) this.navigateToPage(page.page - 1);
  }

  protected goToNextPage(): void {
    const page = this.page();
    if (page && !page.last) this.navigateToPage(page.page + 1);
  }

  protected goToLastPage(): void {
    const page = this.page();
    if (page && page.totalPages > 0) this.navigateToPage(page.totalPages - 1);
  }

  protected beginDelete(report: ReportSummaryResponse): void {
    if (this.deletionState().status === 'idle') {
      this.deletionAnnouncement.set(null);
      this.deletionState.set({ status: 'confirming', report });
    }
  }

  protected cancelDelete(): void {
    const current = this.deletionState();
    if (current.status === 'confirming' || current.status === 'error') {
      this.deletionState.set({ status: 'idle' });
    }
  }

  protected confirmDelete(): void {
    const current = this.deletionState();
    if (
      current.status === 'idle' ||
      current.status === 'deleting' ||
      (current.status === 'error' && !current.failure.canRetry)
    ) {
      return;
    }

    const report = current.report;
    this.deletionState.set({ status: 'deleting', report });
    this.reportService
      .deleteReport(report.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.reconcileDeletedReport(report.id, false);
        },
        error: (error: unknown) => {
          const failure = reportDeletionFailure(error);
          if (failure.kind === 'already-absent') {
            this.reconcileDeletedReport(report.id, true);
            return;
          }
          this.deletionState.set({ status: 'error', report, failure });
        },
      });
  }

  protected accountChanged(accountId: string | null): void {
    const selected = accountId ? this.accountContext.selected() : null;
    this.platformFilter.set(selected?.platformCode ?? null);
    this.reloadFirstPage();
  }

  protected platformChanged(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.platformFilter.set(value || null);
    this.accountContext.clear();
    this.reloadFirstPage();
  }

  private loadPage(pageIndex: number): void {
    if (this.loadingPage === pageIndex) return;

    this.loadSubscription?.unsubscribe();
    const previousPage = this.page();
    this.loadingPage = pageIndex;
    this.state.set({ status: 'loading', page: previousPage, requestedPage: pageIndex });

    this.loadSubscription = this.reportService
      .listReports(pageIndex, PAGE_SIZE, this.accountContext.selectedId(), this.platformFilter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.loadSubscription = null;
          this.loadingPage = null;

          if (page.page !== pageIndex) {
            this.handleError(
              new InvalidReportResponseError('Report page does not match the requested page.'),
              pageIndex,
              previousPage,
            );
            return;
          }

          if (page.content.length === 0 && pageIndex > 0) {
            const validPage = page.totalPages > 0 ? page.totalPages - 1 : 0;
            if (validPage !== pageIndex) {
              this.state.set({ status: 'loading', page: previousPage, requestedPage: validPage });
              this.navigateToPage(validPage, true);
              return;
            }
          }

          this.state.set({
            status: page.content.length === 0 ? 'empty' : 'success',
            page,
          });
        },
        error: (error: unknown) => {
          this.loadSubscription = null;
          this.loadingPage = null;
          this.handleError(error, pageIndex, previousPage);
        },
      });
  }

  private handleError(
    error: unknown,
    requestedPage: number,
    previousPage: PageResponse<ReportSummaryResponse> | null,
  ): void {
    if (error instanceof InvalidReportResponseError) {
      this.setError(
        'invalid-response',
        'Os dados recebidos para o histórico são inválidos. Tente novamente.',
        true,
        requestedPage,
        previousPage,
      );
      return;
    }

    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        this.setError(
          'session',
          'Sua sessão expirou. Entre novamente para consultar seus relatórios.',
          false,
          requestedPage,
          previousPage,
        );
        return;
      }
      if (error.status === 403) {
        this.setError(
          'forbidden',
          'Você não tem permissão para consultar este histórico.',
          false,
          requestedPage,
          previousPage,
        );
        return;
      }
      if (isApiError(error.error) && error.error.code === 'INVALID_PAGINATION') {
        this.setError(
          'invalid-pagination',
          'A página solicitada não é válida.',
          false,
          requestedPage,
          previousPage,
        );
        return;
      }
      if (error.status === 0 || (isApiError(error.error) && error.error.code === 'NETWORK_ERROR')) {
        this.setError(
          'network',
          'Não foi possível conectar ao serviço para carregar o histórico.',
          true,
          requestedPage,
          previousPage,
        );
        return;
      }
    }

    this.setError(
      'unknown',
      'Não foi possível carregar o histórico de relatórios.',
      true,
      requestedPage,
      previousPage,
    );
  }

  private reconcileDeletedReport(reportId: string, alreadyAbsent: boolean): void {
    const currentPage = this.page();
    this.deletionState.set({ status: 'idle' });
    this.deletionAnnouncement.set(
      alreadyAbsent
        ? 'O relatório já não estava disponível e foi removido da interface.'
        : 'Relatório excluído com sucesso.',
    );
    if (!currentPage) return;

    const content = currentPage.content.filter((report) => report.id !== reportId);
    const removedLocally = content.length !== currentPage.content.length;
    const totalElements = Math.max(
      0,
      currentPage.totalElements - (removedLocally ? 1 : 0),
    );
    const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / currentPage.size);

    if (content.length === 0 && totalElements > 0) {
      if (currentPage.page > 0) {
        this.navigateToPage(Math.max(0, Math.min(currentPage.page - 1, totalPages - 1)), true);
      } else {
        this.loadPage(0);
      }
      return;
    }

    const reconciledPage: PageResponse<ReportSummaryResponse> = {
      ...currentPage,
      content,
      totalElements,
      totalPages,
      first: currentPage.page === 0,
      last: totalPages === 0 || currentPage.page + 1 >= totalPages,
    };
    this.state.set({
      status: content.length === 0 ? 'empty' : 'success',
      page: reconciledPage,
    });
  }

  private setError(
    kind: HistoryErrorKind,
    message: string,
    canRetry: boolean,
    requestedPage: number,
    page: PageResponse<ReportSummaryResponse> | null = this.page(),
  ): void {
    this.state.set({ status: 'error', page, requestedPage, kind, message, canRetry });
  }

  private navigateToPage(pageIndex: number, replaceUrl = false): void {
    if (!Number.isSafeInteger(pageIndex) || pageIndex < 0) return;

    void this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: { pagina: pageIndex === 0 ? null : pageIndex + 1 },
        queryParamsHandling: 'merge',
        replaceUrl,
      })
      .then((navigated) => {
        if (!navigated && this.state().status === 'loading') {
          this.loadingPage = null;
          this.setError(
            'unknown',
            'Não foi possível acessar a página solicitada.',
            true,
            pageIndex,
          );
        }
      });
  }

  private reloadFirstPage(): void {
    const currentPage = this.page();
    if (currentPage?.page === 0 || this.route.snapshot.queryParamMap.get('pagina') === null) {
      this.loadPage(0);
      return;
    }
    this.navigateToPage(0);
  }
}

function parsePageIndex(value: string | null): number | null {
  if (value === null || value === '') return 0;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const displayPage = Number(value);
  return Number.isSafeInteger(displayPage) ? displayPage - 1 : null;
}
