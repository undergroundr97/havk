import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  ParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { BehaviorSubject, Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiError } from '../../../../core/http/api-error.model';
import {
  PageResponse,
  ReportSummaryResponse,
} from '../../../reports/data-access/report.models';
import { InvalidReportResponseError } from '../../../reports/data-access/report-response.parser';
import { ReportService } from '../../../reports/data-access/report.service';
import { ReportHistoryPage } from './report-history-page';
import { PlatformAccountContextStore } from '../../../platform-accounts/data-access/platform-account-context.store';
import { platformAccountContextStub } from '../../../platform-accounts/testing/platform-account-context.stub';

describe('ReportHistoryPage', () => {
  const listReports = vi.fn<(
    page?: number, size?: number, platformAccountId?: string | null, platformCode?: string | null,
  ) => Observable<PageResponse<ReportSummaryResponse>>>();
  const deleteReport = vi.fn<(reportId: string) => Observable<void>>();
  let queryParams: BehaviorSubject<ParamMap>;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryParams = new BehaviorSubject(convertToParamMap({}));
    listReports.mockReset();
    deleteReport.mockReset();
    listReports.mockReturnValue(of(firstPage));
    deleteReport.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      imports: [ReportHistoryPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParams } },
        { provide: ReportService, useValue: { listReports, deleteReport } },
        { provide: PlatformAccountContextStore, useFactory: platformAccountContextStub },
      ],
    });

    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('loads the first page once and exposes an announced loading state', () => {
    const response = new Subject<PageResponse<ReportSummaryResponse>>();
    listReports.mockReturnValue(response);
    const fixture = createFixture();

    expect(listReports).toHaveBeenCalledOnce();
    expect(listReports).toHaveBeenCalledWith(
      0, 20, '00000000-0000-4000-8000-000000000003', null,
    );
    expect(fixture.nativeElement.textContent).toContain('Carregando histórico');
    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
    expect(response.observed).toBe(true);

    fixture.destroy();
    expect(response.observed).toBe(false);
  });

  it('renders success in backend order with every roadmap metadata field and semantic structure', () => {
    listReports.mockReturnValue(of({ ...firstPage, content: [secondSummary, firstSummary] }));
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const titles = Array.from(
      host.querySelectorAll<HTMLElement>('.history-item h2'),
      (heading) => heading.textContent?.trim(),
    );

    expect(titles).toEqual(['Segundo relatório', 'Primeiro relatório']);
    expect(host.textContent).toContain('Canal secundário');
    expect(host.textContent).toContain('Assunto dois');
    expect(host.textContent).toContain('3');
    expect(host.querySelector('ol.history-list')).not.toBeNull();
    expect(host.querySelectorAll('article')).toHaveLength(2);
    expect(host.querySelector('nav[aria-label="Paginação do histórico"]')).not.toBeNull();
    expect(document.activeElement).toBe(host.querySelector('h1'));
  });

  it('renders an actionable empty state without pagination', () => {
    listReports.mockReturnValue(of(emptyPage));
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Você ainda não possui relatórios');
    expect(host.querySelector<HTMLAnchorElement>('a[href="/workspace"]')).not.toBeNull();
    expect(host.querySelector('.pagination')).toBeNull();
  });

  it('reads the one-based URL page and exposes first, previous, next and last navigation', () => {
    queryParams.next(convertToParamMap({ pagina: '2' }));
    listReports.mockReturnValue(of(middlePage));
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;

    expect(listReports).toHaveBeenCalledWith(
      1, 20, '00000000-0000-4000-8000-000000000003', null,
    );
    expect(host.textContent).toContain('Página 2 de 3');

    clickByLabel(host, 'Ir para a primeira página');
    expectPageNavigation(null);
    clickByLabel(host, 'Ir para a página anterior');
    expectPageNavigation(null);
    clickByLabel(host, 'Ir para a próxima página');
    expectPageNavigation(3);
    clickByLabel(host, 'Ir para a última página');
    expectPageNavigation(3);
  });

  it('rejects invalid and negative URL pages without issuing an HTTP request', () => {
    queryParams.next(convertToParamMap({ pagina: '-1' }));
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;

    expect(listReports).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Página inválida');
    expect(host.textContent).toContain('inteiro e maior que zero');

    clickByText(host, 'Ir para a primeira página');
    expectPageNavigation(null);
  });

  it('does not duplicate requests when the same URL page is emitted again', () => {
    const fixture = createFixture();
    queryParams.next(convertToParamMap({}));
    fixture.detectChanges();

    expect(listReports).toHaveBeenCalledOnce();
  });

  it('preserves the previous content while changing pages', () => {
    const fixture = createFixture();
    const nextResponse = new Subject<PageResponse<ReportSummaryResponse>>();
    listReports.mockReturnValue(nextResponse);

    queryParams.next(convertToParamMap({ pagina: '2' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Primeiro relatório');
    expect(fixture.nativeElement.textContent).toContain('Carregando página 2');
    expect(fixture.nativeElement.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
  });

  it('reconciles an empty out-of-range page to the last valid page without a loop', () => {
    queryParams.next(convertToParamMap({ pagina: '4' }));
    listReports.mockReturnValue(of(outOfRangePage));
    const fixture = createFixture();

    expect(listReports).toHaveBeenCalledWith(
      3, 20, '00000000-0000-4000-8000-000000000003', null,
    );
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { pagina: 3 },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    listReports.mockReturnValue(of(lastPage));
    queryParams.next(convertToParamMap({ pagina: '3' }));
    fixture.detectChanges();

    expect(listReports).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Último relatório');
  });

  it('treats an invalid payload as an error and supports an explicit failed retry', () => {
    listReports.mockReturnValue(
      throwError(() => new InvalidReportResponseError('Invalid report page.')),
    );
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Dados inválidos');
    expect(host.textContent).toContain('Tente novamente');

    clickByText(host, 'Tentar novamente');
    fixture.detectChanges();

    expect(listReports).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Dados inválidos');
  });

  it.each([
    {
      label: 'forbidden',
      error: httpError(403, 'ACCESS_DENIED'),
      expected: 'Acesso não permitido',
    },
    {
      label: 'invalid pagination',
      error: httpError(400, 'INVALID_PAGINATION'),
      expected: 'Página inválida',
    },
    {
      label: 'network',
      error: httpError(0, 'NETWORK_ERROR'),
      expected: 'conectar ao serviço',
    },
    {
      label: 'unknown',
      error: new Error('unexpected'),
      expected: 'Não foi possível carregar o histórico',
    },
  ])('renders a safe and distinct $label error', ({ error, expected }) => {
    listReports.mockReturnValue(throwError(() => error));
    const fixture = createFixture();

    expect(fixture.nativeElement.textContent).toContain(expected);
  });

  it('leaves expired-session redirection to the central auth interceptor', () => {
    queryParams.next(convertToParamMap({ pagina: '2' }));
    listReports.mockReturnValue(throwError(() => httpError(401, 'UNAUTHENTICATED')));
    const fixture = createFixture();

    expect(fixture.nativeElement.textContent).toContain('Sessão inválida');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens an accessible confirmation and cancellation does not delete or lose focus', async () => {
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const deleteButton = findButton(host, 'Excluir relatório');
    deleteButton.focus();
    deleteButton.click();
    fixture.detectChanges();
    await Promise.resolve();

    const dialog = host.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.textContent).toContain('não poderá ser recuperado');
    expect(document.activeElement?.textContent?.trim()).toBe('Cancelar');

    clickByText(host, 'Cancelar');
    fixture.detectChanges();
    await Promise.resolve();

    expect(deleteReport).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(deleteButton);
  });

  it('blocks duplicate deletion while the confirmed request is in progress', async () => {
    const deletion = new Subject<void>();
    deleteReport.mockReturnValue(deletion);
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;
    clickByText(host, 'Excluir relatório');
    fixture.detectChanges();
    clickDialogButton(host, 'Excluir relatório');
    fixture.detectChanges();

    expect(deleteReport).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Excluindo relatório');
    expect(fixture.nativeElement.textContent).toContain(firstSummary.title);
    expect(
      Array.from(
        host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
      ).every((button) => button.disabled),
    ).toBe(true);
  });

  it('removes a report only after successful deletion and announces the result', () => {
    listReports.mockReturnValue(of(page([firstSummary], 0, 1, 1)));
    const fixture = createFixture();
    clickByText(fixture.nativeElement, 'Excluir relatório');
    fixture.detectChanges();
    clickDialogButton(fixture.nativeElement, 'Excluir relatório');
    fixture.detectChanges();

    expect(deleteReport).toHaveBeenCalledWith(firstSummary.id);
    expect(fixture.nativeElement.textContent).not.toContain(firstSummary.title);
    expect(fixture.nativeElement.textContent).toContain('Relatório excluído com sucesso');
    expect(fixture.nativeElement.textContent).toContain('Você ainda não possui relatórios');
    expect(document.activeElement).toBe(
      (fixture.nativeElement as HTMLElement).querySelector('#report-history-title'),
    );
  });

  it('treats a concurrent 404 as already absent and removes the stale item', () => {
    listReports.mockReturnValue(of(page([firstSummary], 0, 1, 1)));
    deleteReport.mockReturnValue(throwError(() => httpError(404, 'REPORT_NOT_FOUND')));
    const fixture = createFixture();
    clickByText(fixture.nativeElement, 'Excluir relatório');
    fixture.detectChanges();
    clickDialogButton(fixture.nativeElement, 'Excluir relatório');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain(firstSummary.title);
    expect(fixture.nativeElement.textContent).toContain('já não estava disponível');
  });

  it.each([
    { status: 401, code: 'UNAUTHENTICATED', retry: false, text: 'sessão expirou' },
    { status: 403, code: 'INVALID_CSRF_TOKEN', retry: true, text: 'segurança expirou' },
    { status: 403, code: 'ACCESS_DENIED', retry: false, text: 'não foi autorizada' },
    { status: 0, code: 'NETWORK_ERROR', retry: true, text: 'conectar ao serviço' },
    { status: 500, code: 'INTERNAL_ERROR', retry: true, text: 'foi mantido' },
  ])('keeps the report after $code and exposes a coherent recovery', ({ status, code, retry, text }) => {
    deleteReport.mockReturnValue(throwError(() => httpError(status, code)));
    const fixture = createFixture();
    clickByText(fixture.nativeElement, 'Excluir relatório');
    fixture.detectChanges();
    clickDialogButton(fixture.nativeElement, 'Excluir relatório');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(firstSummary.title);
    expect(fixture.nativeElement.textContent).toContain(text);
    expect(fixture.nativeElement.textContent.includes('Tentar excluir novamente')).toBe(retry);
  });

  it('returns to the previous page after deleting its last item without a loop', () => {
    queryParams.next(convertToParamMap({ pagina: '2' }));
    listReports.mockReturnValue(of(page([secondSummary], 1, 21, 2)));
    const fixture = createFixture();
    clickByText(fixture.nativeElement, 'Excluir relatório');
    fixture.detectChanges();
    clickDialogButton(fixture.nativeElement, 'Excluir relatório');
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { pagina: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('refreshes the first page when a removed last visible item is not the last total item', () => {
    listReports
      .mockReturnValueOnce(of(page([firstSummary], 0, 2, 1)))
      .mockReturnValueOnce(of(page([secondSummary], 0, 1, 1)));
    const fixture = createFixture();
    clickByText(fixture.nativeElement, 'Excluir relatório');
    fixture.detectChanges();
    clickDialogButton(fixture.nativeElement, 'Excluir relatório');
    fixture.detectChanges();

    expect(listReports).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain(secondSummary.title);
    expect(fixture.nativeElement.textContent).not.toContain(firstSummary.title);
  });

  it('keeps the previous page visible when a recoverable transition fails', () => {
    const fixture = createFixture();
    listReports.mockReturnValue(throwError(() => httpError(0, 'NETWORK_ERROR')));

    queryParams.next(convertToParamMap({ pagina: '2' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Primeiro relatório');
    expect(fixture.nativeElement.textContent).toContain('conectar ao serviço');
  });

  function createFixture(): ComponentFixture<ReportHistoryPage> {
    const fixture = TestBed.createComponent(ReportHistoryPage);
    fixture.detectChanges();
    return fixture;
  }

  function expectPageNavigation(pagina: number | null): void {
    expect(navigate).toHaveBeenLastCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { pagina },
      queryParamsHandling: 'merge',
      replaceUrl: false,
    });
  }
});

function clickByLabel(host: HTMLElement, label: string): void {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === label,
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  button.click();
}

function clickByText(host: HTMLElement, text: string): void {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) throw new Error(`Button not found: ${text}`);
  button.click();
}

function findButton(host: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

function clickDialogButton(host: HTMLElement, text: string): void {
  const dialog = host.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error('Dialog not found');
  clickByText(dialog, text);
}

function httpError(status: number, code: string): HttpErrorResponse {
  const error: ApiError = {
    code,
    message: 'Mensagem segura.',
    status,
    timestamp: '2026-07-22T12:06:00Z',
    path: '/api/reports',
    details: [],
  };
  return new HttpErrorResponse({ status, error });
}

function page(
  content: readonly ReportSummaryResponse[],
  pageNumber: number,
  totalElements: number,
  totalPages: number,
): PageResponse<ReportSummaryResponse> {
  return {
    content,
    page: pageNumber,
    size: 20,
    totalElements,
    totalPages,
    first: pageNumber === 0,
    last: totalPages === 0 || pageNumber + 1 >= totalPages,
  };
}

const firstSummary: ReportSummaryResponse = {
  id: '00000000-0000-4000-8000-000000000001',
  requestId: '00000000-0000-4000-8000-000000000002',
  platformAccountId: '00000000-0000-4000-8000-000000000003',
  platformCode: 'YOUTUBE',
  platformHandle: '@havk',
  channelId: '00000000-0000-4000-8000-000000000003',
  title: 'Primeiro relatório',
  summary: 'Resumo inicial.',
  generatedAt: '2026-07-22T12:05:00Z',
  createdAt: '2026-07-22T12:05:01Z',
  channelName: 'Canal HAVK',
  requestedTopic: null,
  requestedIdeaCount: 2,
  status: 'COMPLETED',
};

const secondSummary: ReportSummaryResponse = {
  ...firstSummary,
  id: '00000000-0000-4000-8000-000000000011',
  requestId: '00000000-0000-4000-8000-000000000012',
  title: 'Segundo relatório',
  summary: 'Resumo secundário.',
  channelName: 'Canal secundário',
  requestedTopic: 'Assunto dois',
  requestedIdeaCount: 3,
};

const lastSummary: ReportSummaryResponse = {
  ...firstSummary,
  id: '00000000-0000-4000-8000-000000000021',
  requestId: '00000000-0000-4000-8000-000000000022',
  title: 'Último relatório',
};

const firstPage = page([firstSummary], 0, 41, 3);
const emptyPage = page([], 0, 0, 0);
const middlePage = page([secondSummary], 1, 41, 3);
const lastPage = page([lastSummary], 2, 41, 3);
const outOfRangePage = page([], 3, 41, 3);
