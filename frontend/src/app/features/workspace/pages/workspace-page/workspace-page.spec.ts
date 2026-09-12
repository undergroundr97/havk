import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthSessionStore } from '../../../../core/auth/auth-session.store';
import { PlatformAccount } from '../../../platform-accounts/data-access/platform-account.models';
import { PlatformAccountContextStore } from '../../../platform-accounts/data-access/platform-account-context.store';
import { CreateReportRequest, ReportPollingEvent, ReportRequestAcceptedResponse } from '../../../report-generation/data-access/report-generation.models';
import { REPORT_POLL_INTERVAL_MS, ReportGenerationService } from '../../../report-generation/data-access/report-generation.service';
import { ReportService } from '../../../reports/data-access/report.service';
import { ReportDetailResponse } from '../../../reports/data-access/report.models';
import {
  ReportConversationDetail,
  ReportConversationSummary,
  WorkspaceMessageRequest,
  WorkspaceMessageResponse,
} from '../../data-access/workspace.models';
import { WorkspaceService } from '../../data-access/workspace.service';
import { WorkspacePage } from './workspace-page';

describe('WorkspacePage', () => {
  const list = vi.fn<() => Observable<readonly ReportConversationSummary[]>>();
  const detail = vi.fn<(id: string) => Observable<ReportConversationDetail>>();
  const archive = vi.fn<(id: string) => Observable<void>>();
  const sendMessage = vi.fn<(request: WorkspaceMessageRequest) => Observable<WorkspaceMessageResponse>>();
  const createRequest = vi.fn<(request: CreateReportRequest) => Observable<ReportRequestAcceptedResponse>>();
  const watchRequest = vi.fn<(id: string) => Observable<ReportPollingEvent>>();
  const regenerateReport = vi.fn<() => Observable<ReportRequestAcceptedResponse>>();
  const selected = signal<PlatformAccount | null>(ACCOUNT);
  const accounts = signal<readonly PlatformAccount[]>([ACCOUNT]);
  const loadAccounts = vi.fn(async () => undefined);
  const selectAccount = vi.fn((id: string) => selected.set(accounts().find((item) => item.id === id) ?? null));
  let routeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let routeQueryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    routeParams = new BehaviorSubject(convertToParamMap({}));
    routeQueryParams = new BehaviorSubject(convertToParamMap({}));
    selected.set(ACCOUNT);
    accounts.set([ACCOUNT]);
    list.mockReset().mockReturnValue(of([]));
    detail.mockReset();
    archive.mockReset().mockReturnValue(of(undefined));
    sendMessage.mockReset();
    createRequest.mockReset();
    watchRequest.mockReset().mockReturnValue(NEVER);
    regenerateReport.mockReset();
    loadAccounts.mockClear();
    selectAccount.mockClear();

    TestBed.configureTestingModule({
      imports: [WorkspacePage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: routeParams, queryParamMap: routeQueryParams } },
        { provide: AuthSessionStore, useValue: {
          session: signal({ status: 'authenticated', user: AUTHENTICATED_USER, message: null }),
          user: computed(() => AUTHENTICATED_USER),
        } },
        { provide: PlatformAccountContextStore, useValue: {
          selected, accounts, load: loadAccounts, select: selectAccount,
        } },
        { provide: WorkspaceService, useValue: { list, detail, archive, sendMessage } },
        { provide: ReportGenerationService, useValue: { watchRequest, createRequest } },
        { provide: ReportService, useValue: { regenerateReport } },
        { provide: REPORT_POLL_INTERVAL_MS, useValue: 60_000 },
      ],
    });

    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(async (commands, extras) => {
      const id = typeof commands[1] === 'string' ? commands[1] : null;
      const mode = extras?.queryParams?.['mode'];
      routeQueryParams.next(convertToParamMap(typeof mode === 'string' ? { mode } : {}));
      routeParams.next(convertToParamMap(id ? { conversationId: id } : {}));
      return true;
    });
  });

  it('upserts the accepted conversation, activates it, updates the URL and removes old feed content', async () => {
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    list.mockReturnValue(of([summary(CONVERSATION_A, 'Conversa anterior', '2026-07-29T10:00:00Z')]));
    detail.mockImplementation((id) => of(id === CONVERSATION_A
      ? conversationDetail(CONVERSATION_A, 'Conversa anterior', 'Conteúdo anterior')
      : conversationDetail(CONVERSATION_B, 'Novo assunto', 'Nova solicitação')));
    sendMessage.mockReturnValue(of(messageResponse(CONVERSATION_B, REQUEST_ID)));
    const fixture = await createFixture();

    await startNewConversation(fixture);
    fillComposer(fixture, 'Quero criar um conteúdo sobre um novo assunto com objetivo editorial.');
    submitComposer(fixture);
    await settle(fixture);

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/workspace', CONVERSATION_B]);
    expect(detail).toHaveBeenCalledWith(CONVERSATION_B);
    expect(activeConversation(fixture)?.textContent).toContain('Novo assunto');
    expect(sidebarTitles(fixture)).toEqual(['Novo assunto', 'Conversa anterior']);
    expect(fixture.nativeElement.textContent).toContain('Nova solicitação');
    expect(fixture.nativeElement.textContent).not.toContain('Conteúdo anterior');
    expect(selected()).toEqual(ACCOUNT);
  });

  it('discards an obsolete GET so conversation A cannot overwrite conversation B', async () => {
    const responseA = new Subject<ReportConversationDetail>();
    const responseB = new Subject<ReportConversationDetail>();
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    list.mockReturnValue(of([
      summary(CONVERSATION_A, 'Conversa A', '2026-07-29T10:00:00Z'),
      summary(CONVERSATION_B, 'Conversa B', '2026-07-29T11:00:00Z'),
    ]));
    detail.mockImplementation((id) => id === CONVERSATION_A ? responseA : responseB);
    const fixture = await createFixture();
    expect(responseA.observed).toBe(true);

    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_B }));
    fixture.detectChanges();
    expect(responseA.observed).toBe(true);
    responseB.next(conversationDetail(CONVERSATION_B, 'Conversa B', 'Conteúdo B'));
    responseB.complete();
    await settle(fixture);

    expect(activeConversation(fixture)?.textContent).toContain('Conversa B');
    expect(fixture.nativeElement.textContent).toContain('Conteúdo B');
    responseA.next(conversationDetail(CONVERSATION_A, 'Conversa A', 'Conteúdo A obsoleto'));
    expect(fixture.nativeElement.textContent).not.toContain('Conteúdo A obsoleto');
  });

  it('clears a real loading error after a later successful response', async () => {
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    list.mockReturnValue(of([summary(CONVERSATION_A, 'Conversa A', '2026-07-29T10:00:00Z')]));
    detail.mockReturnValueOnce(throwError(() => new Error('falha')))
      .mockReturnValueOnce(of(conversationDetail(CONVERSATION_A, 'Título atualizado', 'Feed recuperado')));
    const fixture = await createFixture();

    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar a conversa');
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    await settle(fixture);

    expect(fixture.nativeElement.textContent).not.toContain('Não foi possível carregar a conversa');
    expect(fixture.nativeElement.textContent).toContain('Feed recuperado');
    expect(activeConversation(fixture)?.textContent).toContain('Título atualizado');
  });

  it('renders a report returned by HTTP 200 even when entries is empty', async () => {
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    list.mockReturnValue(of([summary(CONVERSATION_A, 'Conversa com relatório', '2026-07-29T10:00:00Z')]));
    detail.mockReturnValue(of(reportConversationDetail(false)));
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Relatório carregado do aggregate');
    expect(host.textContent).toContain('Resultado real');
    expect(host.textContent).not.toContain('Qual oportunidade vamos desenvolver?');
    expect(host.querySelector(`[data-feed-key="report:${REPORT_ID}"]`)).not.toBeNull();
    expect(host.querySelector('.conversation-error')).toBeNull();
  });

  it('renders a compact spoken timeline for report-contract-v3 in the feed', async () => {
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    const aggregate = reportConversationDetail(false);
    detail.mockReturnValue(of({ ...aggregate, reports: [reportV3()] }));
    const fixture = await createFixture();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Vídeo curto');
    expect(text).toContain('0:55');
    expect(text).toContain('Texto falado do gancho.');
    expect(text).toContain('Transição: Agora conectamos o problema.');
    expect(fixture.nativeElement.querySelectorAll('.feed-script')).toHaveLength(4);
  });

  it('preserves report version and simulated status from the aggregate', async () => {
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    list.mockReturnValue(of([summary(CONVERSATION_A, 'Conversa simulada', '2026-07-29T10:00:00Z')]));
    detail.mockReturnValue(of(reportConversationDetail(true)));
    const fixture = await createFixture();

    expect(fixture.nativeElement.textContent).toContain('Versão 3');
    expect(fixture.nativeElement.textContent).toContain('Simulado');
  });

  it('keeps cached feed without refetching when the same route is emitted again', async () => {
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    list.mockReturnValue(of([summary(CONVERSATION_A, 'Conversa A', '2026-07-29T10:00:00Z')]));
    detail.mockReturnValueOnce(of(conversationDetail(CONVERSATION_A, 'Conversa A', 'Feed preservado')))
      .mockReturnValueOnce(throwError(() => new Error('indisponível')));
    const fixture = await createFixture();

    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('Feed preservado');
    expect(detail).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).not.toContain('conteúdo carregado foi preservado');
    expect(fixture.nativeElement.querySelector('.conversation-error')).toBeNull();
  });

  it('deduplicates conversation ids and updates title and timestamp without a reload', async () => {
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    list.mockReturnValue(of([
      summary(CONVERSATION_A, 'Título antigo', '2026-07-29T10:00:00Z'),
      summary(CONVERSATION_A, 'Duplicada', '2026-07-29T09:00:00Z'),
    ]));
    detail.mockReturnValue(of(conversationDetail(CONVERSATION_A, 'Título após solicitação', 'Entrada')));
    const fixture = await createFixture();

    expect(sidebarTitles(fixture)).toEqual(['Título após solicitação']);
    expect(activeConversation(fixture)?.textContent).toContain('Título após solicitação');
  });

  it('selects an existing conversation immediately, clears the old feed and never creates a request', async () => {
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    const responseB = new Subject<ReportConversationDetail>();
    list.mockReturnValue(of([
      summary(CONVERSATION_A, 'Conversa A', '2026-07-29T10:00:00Z'),
      summary(CONVERSATION_B, 'Conversa B', '2026-07-29T11:00:00Z'),
    ]));
    detail.mockImplementation((id) => id === CONVERSATION_A
      ? of(conversationDetail(CONVERSATION_A, 'Conversa A', 'Feed A')) : responseB);
    const fixture = await createFixture();
    const page = fixture.componentInstance as unknown as {
      beginConversationSelection(id: string): void;
    };
    page.beginConversationSelection(CONVERSATION_B);
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_B }));
    fixture.detectChanges();

    expect(activeConversation(fixture)?.textContent).toContain('Conversa B');
    expect(fixture.nativeElement.textContent).not.toContain('Feed A');
    expect(fixture.nativeElement.textContent).toContain('Carregando conversa');
    expect(sendMessage).not.toHaveBeenCalled();

    responseB.next(conversationDetail(CONVERSATION_B, 'Conversa B', 'Feed B'));
    responseB.complete();
    await settle(fixture);
    expect(fixture.nativeElement.textContent).toContain('Feed B');
  });

  it('keeps feed above a compact and accessible single-line composer', async () => {
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const feedRegion = host.querySelector<HTMLElement>('[data-testid="workspace-feed-region"]');
    const composer = host.querySelector<HTMLFormElement>('form.composer');
    const textarea = host.querySelector<HTMLTextAreaElement>('#workspace-message');
    const searchRow = host.querySelector<HTMLElement>('.composer-search-row');

    expect(feedRegion).not.toBeNull();
    expect(composer).not.toBeNull();
    if (!feedRegion || !composer || !textarea || !searchRow) {
      throw new Error('Estrutura do workspace não encontrada.');
    }
    expect(feedRegion.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(composer?.closest('.feed')).toBeNull();
    expect(textarea?.rows).toBe(1);
    expect(textarea?.getAttribute('placeholder')).toBe('Pesquisar um tema…');
    const searchButton = searchRow.querySelector<HTMLButtonElement>('.submit-button');
    expect(searchButton?.textContent?.trim()).toBe('↑');
    expect(searchButton?.getAttribute('aria-label')).toBe('Pesquisar');
    expect(searchRow.textContent).not.toContain('YOUTUBE · Canal HAVK');
    expect(searchRow.textContent).not.toContain('Simulado');
    expect(getComputedStyle(textarea).borderTopWidth).toBe('0px');
    expect(getComputedStyle(textarea).boxShadow).toBe('none');
    textarea?.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(host.textContent).not.toContain('Escreva o que você deseja criar.');
    expect(feedRegion?.getAttribute('aria-busy')).toBe('false');
    expect(host.querySelector('.feed')?.getAttribute('aria-live')).toBe('polite');
  });

  it('grows the single textarea only to the configured limit without template insertion buttons', async () => {
    const fixture = await createFixture();
    const textarea = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLTextAreaElement>('#workspace-message');
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 480 });
    textarea?.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(textarea?.style.height).toBe('210px');
    expect(textarea?.style.overflowY).toBe('auto');
    expect(textarea?.value).toBe('');
    expect(fixture.nativeElement.textContent).not.toContain('Orientações');
    expect(fixture.nativeElement.textContent).not.toContain('Enter envia');
  });

  it('keeps the search textarea at one-line height while its content fits', async () => {
    const fixture = await createFixture();
    const textarea = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLTextAreaElement>('#workspace-message');
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 24 });
    textarea?.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(textarea?.style.height).toBe('42px');
    expect(textarea?.style.overflowY).toBe('hidden');
  });

  it('sends with Enter, keeps Shift+Enter as a newline convention and prevents empty sends', async () => {
    detail.mockReturnValue(of(conversationDetail(CONVERSATION_B, 'Spring Boot', 'Mensagem enviada')));
    sendMessage.mockReturnValue(of(messageResponse(CONVERSATION_B, REQUEST_ID)));
    const fixture = await createFixture();
    const textarea = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLTextAreaElement>('#workspace-message');
    if (!textarea) throw new Error('Composer não encontrado.');

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(sendMessage).not.toHaveBeenCalled();
    fillComposer(fixture, 'Quero criar um conteúdo sobre Spring Boot.');
    const shiftEnter = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true });
    textarea.dispatchEvent(shiftEnter);
    expect(shiftEnter.defaultPrevented).toBe(false);
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await settle(fixture);

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage.mock.calls[0]?.[0]).toMatchObject({
      platformAccountId: ACCOUNT_ID,
      message: 'Quero criar um conteúdo sobre Spring Boot.',
    });
    expect(textarea.value).toBe('');
  });

  it('preserves the natural message when the backend rejects it', async () => {
    sendMessage.mockReturnValue(throwError(() => new Error('interpretação indisponível')));
    const fixture = await createFixture();
    fillComposer(fixture, 'Mensagem que deve permanecer');
    submitComposer(fixture);
    await settle(fixture);

    expect((fixture.nativeElement as HTMLElement)
      .querySelector<HTMLTextAreaElement>('#workspace-message')?.value).toBe('Mensagem que deve permanecer');
    expect(fixture.nativeElement.textContent).toContain('Não foi possível enviar a mensagem');
  });

  it('renders a HAVK clarification in the feed without starting client-side generation', async () => {
    const clarification = 'Qual assunto ou resultado você deseja alcançar com esse conteúdo?';
    sendMessage.mockReturnValue(of({
      ...messageResponse(CONVERSATION_B, null),
      clarificationRequired: true,
      clarificationQuestion: clarification,
      interpretation: null,
      outcome: 'CLARIFICATION_REQUIRED',
      assistantMessage: clarification,
    }));
    detail.mockReturnValue(of({
      ...conversationDetail(CONVERSATION_B, 'Nova conversa', 'Faça um conteúdo.'),
      entries: [
        ...conversationDetail(CONVERSATION_B, 'Nova conversa', 'Faça um conteúdo.').entries,
        {
          id: '00000000-0000-4000-8000-000000000403', entryType: 'INFORMATION', sequence: 2,
          displayText: clarification, reportRequestId: null, reportId: null, trendSearchId: null,
          metadata: {}, createdAt: '2026-07-29T11:01:00Z',
        },
      ],
    }));
    const fixture = await createFixture();
    fillComposer(fixture, 'Faça um conteúdo.');
    submitComposer(fixture);
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain(clarification);
    expect(watchRequest).not.toHaveBeenCalled();
  });

  it('removes the redundant workspace header and account bar', async () => {
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.quick-prompts')).toBeNull();
    expect(host.querySelector<HTMLTextAreaElement>('#workspace-message')?.value).toBe('');
    expect(host.querySelector('.workspace-header')).toBeNull();
    expect(host.querySelector('.account-bar')).toBeNull();
    expect(host.textContent).not.toContain('Transforme contexto em conteúdo');
    expect(host.textContent).not.toContain('Histórico de relatórios');
    expect(host.textContent).not.toContain('Trocar conta');
  });

  it('renders processing in the feed while keeping the composer compact and busy', async () => {
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    list.mockReturnValue(of([summary(CONVERSATION_A, 'Em geração', '2026-07-29T10:00:00Z')]));
    detail.mockReturnValue(of(processingDetail()));
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const processing = host.querySelector<HTMLElement>('.processing-entry');
    const composer = host.querySelector<HTMLFormElement>('form.composer');

    expect(processing?.closest('.feed')).not.toBeNull();
    expect(processing?.closest('.composer')).toBeNull();
    expect(host.querySelectorAll('.processing-entry')).toHaveLength(1);
    expect(composer?.getAttribute('aria-busy')).toBe('true');
    expect(composer?.querySelector<HTMLButtonElement>('.composer-search-row .submit-button')?.textContent?.trim())
      .toBe('↑');
    expect(composer?.querySelector<HTMLButtonElement>('.composer-search-row .submit-button')?.getAttribute('aria-label'))
      .toBe('Pesquisar');
    expect(fixture.nativeElement.querySelector('.feed')?.getAttribute('aria-busy')).toBe('true');
  });

  it('presents the terminal provider stage and violations without duplicating the failure message', async () => {
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    list.mockReturnValue(of([summary(CONVERSATION_A, 'Falha diagnosticada', '2026-08-04T12:00:00Z')]));
    detail.mockReturnValue(of(failedDiagnosticDetail()));
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const message = 'Não foi possível validar o roteiro gerado. Etapa: JSON_PARSE. Violações: MALFORMED_JSON.';

    expect(host.textContent?.split(message)).toHaveLength(2);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(host.querySelector('.failure-diagnostic')).toBeNull();
    expect(host.textContent).not.toContain('INVALID_RESPONSE / INVALID_AI_RESPONSE');
  });

  it('ships bounded responsive styles without horizontal workspace scrolling', async () => {
    await createFixture();
    const styles = Array.from(document.querySelectorAll('style'), (item) => item.textContent ?? '').join('\n');
    expect(styles).toContain('max-height: 210px');
    expect(styles).toContain('overflow-x: hidden');
    expect(styles).toContain('flex: 1 1 auto');
    expect(styles).toContain('max-width: none');
    expect(styles).toContain('padding: clamp(0.5rem, 1.2vw, 1rem)');
    expect(styles).toMatch(/@media \(max-width: 650px\)[\s\S]*\.conversation-main[\s\S]*min-height: 0/);
    expect(styles).toMatch(/textarea[^\n]*:focus-visible/);
    expect(styles).toContain('outline: none');
    expect(styles).toContain('var(--havk-focus-ring)');
    expect(styles).toContain('max-width: 650px');
    expect(styles).toContain('safe-area-inset-bottom');
    expect(styles).toContain('prefers-reduced-motion: reduce');
  });

  it('disables Enviar for empty or whitespace-only text and never posts it', async () => {
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const button = () => host.querySelector<HTMLButtonElement>('.submit-button');
    expect(button()?.disabled).toBe(true);
    fillComposer(fixture, ' \n ');
    expect(button()?.disabled).toBe(true);
    submitComposer(fixture);
    await settle(fixture);
    expect(sendMessage).not.toHaveBeenCalled();
    fillComposer(fixture, 'Mensagem válida');
    expect(button()?.disabled).toBe(false);
  });

  it('prevents a double text submission while the first POST is pending', async () => {
    const pending = new Subject<WorkspaceMessageResponse>();
    sendMessage.mockReturnValue(pending);
    detail.mockReturnValue(of(conversationDetail(CONVERSATION_B, 'Mensagem única', 'Mensagem única')));
    const fixture = await createFixture();
    fillComposer(fixture, 'Mensagem única');
    submitComposer(fixture);
    submitComposer(fixture);
    expect(sendMessage).toHaveBeenCalledOnce();
    pending.next(messageResponse(CONVERSATION_B, REQUEST_ID));
    pending.complete();
    await settle(fixture);
  });

  it('runs SURPRISE_ME once through the semantic workspace contract without changing account', async () => {
    detail.mockReturnValue(of(conversationDetail(CONVERSATION_B, 'Me surpreenda', 'Pesquisa iniciada.')));
    sendMessage.mockReturnValue(of({
      ...messageResponse(CONVERSATION_B, REQUEST_ID),
      researchMode: 'SURPRISE_ME',
    }));
    const fixture = await createFixture();
    await switchToSurprise(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.research-mode-selector')?.getAttribute('data-active')).toBe('SURPRISE_ME');
    expect(host.querySelector<HTMLButtonElement>('.research-mode-tab.is-active')?.textContent)
      .toContain('Me surpreenda');
    const trendButton = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.surprise-composer .submit-button');
    trendButton?.click();
    trendButton?.click();
    await settle(fixture);

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage.mock.calls[0]?.[0]).toMatchObject({
      platformAccountId: ACCOUNT_ID,
      researchMode: 'SURPRISE_ME',
      message: 'Me surpreenda com base no meu canal.',
    });
    expect(createRequest).not.toHaveBeenCalled();
    expect(selected()?.id).toBe(ACCOUNT_ID);
  });

  it('keeps global history and the current request while composer mode changes and the component is recreated', async () => {
    const progressEvents = new Subject<ReportPollingEvent>();
    const surpriseSummary = {
      ...summary(CONVERSATION_B, 'Surpresa em andamento', '2026-09-11T14:00:00Z'),
      researchMode: 'SURPRISE_ME' as const,
      hasActiveRequest: true,
    };
    const surpriseDetail = processingDetailFor(CONVERSATION_B, 'AUTOMATIC_TREND_DISCOVERY');
    const surpriseModeDetail = {
      ...surpriseDetail,
      conversation: { ...surpriseDetail.conversation, researchMode: 'SURPRISE_ME' as const },
    };
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_B }));
    list.mockReturnValue(of([
      surpriseSummary,
      summary(CONVERSATION_A, 'Pesquisa selecionada', '2026-09-11T13:00:00Z'),
    ]));
    detail.mockImplementation((id) => of(id === CONVERSATION_A
      ? conversationDetail(CONVERSATION_A, 'Pesquisa selecionada', 'Feed SEARCH preservado')
      : surpriseModeDetail));
    watchRequest.mockReturnValue(progressEvents);
    const fixture = await createFixture();

    await switchToSearch(fixture);
    expect(fixture.nativeElement.textContent).toContain('Gerar conteúdo com tendências atuais sobre meu canal');
    expect(sidebarTitles(fixture)).toEqual(expect.arrayContaining([
      'Descoberta de oportunidade',
      'Pesquisa selecionada',
    ]));
    expect(navigate).not.toHaveBeenCalled();
    const activeSurpriseRequest = surpriseModeDetail.requests[0];
    if (!activeSurpriseRequest) throw new Error('Expected active surprise request.');
    progressEvents.next({ kind: 'update', request: {
      ...activeSurpriseRequest,
      progressPercent: 42,
      progressMessage: 'Atualização recebida em segundo plano.',
    } });
    await switchToSurprise(fixture);

    expect(fixture.nativeElement.textContent).toContain('Atualização recebida em segundo plano.');
    expect(fixture.nativeElement.textContent).toContain('42%');
    expect(fixture.nativeElement.textContent).not.toContain('Carregando workspace');
    expect(fixture.nativeElement.textContent).not.toContain('Carregando conversa');
    expect(list).toHaveBeenCalledOnce();
    expect(detail.mock.calls.filter(([id]) => id === CONVERSATION_A)).toHaveLength(0);
    expect(detail.mock.calls.filter(([id]) => id === CONVERSATION_B)).toHaveLength(1);
    expect(watchRequest).toHaveBeenCalledOnce();

    fixture.destroy();
    const recreated = await createFixture();
    expect(recreated.nativeElement.textContent).toContain('Atualização recebida em segundo plano.');
    expect(list).toHaveBeenCalledOnce();
    expect(detail.mock.calls.filter(([id]) => id === CONVERSATION_B)).toHaveLength(1);
    expect(watchRequest).toHaveBeenCalledOnce();
  });

  it('creates a new conversation only when submitting with a mode different from the open conversation', async () => {
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    list.mockReturnValue(of([summary(CONVERSATION_A, 'Pesquisa atual', '2026-09-11T13:00:00Z')]));
    const surpriseDetail = processingDetailFor(CONVERSATION_B, 'AUTOMATIC_TREND_DISCOVERY');
    detail.mockImplementation((id) => id === CONVERSATION_A
      ? of(conversationDetail(CONVERSATION_A, 'Pesquisa atual', 'Feed atual preservado'))
      : of({
          ...surpriseDetail,
          conversation: { ...surpriseDetail.conversation, researchMode: 'SURPRISE_ME' },
        }));
    sendMessage.mockReturnValue(of({
      ...messageResponse(CONVERSATION_B, REQUEST_ID),
      researchMode: 'SURPRISE_ME',
    }));
    const fixture = await createFixture();

    await switchToSurprise(fixture);
    expect(fixture.nativeElement.textContent).toContain('Feed atual preservado');
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.surprise-composer .submit-button')?.click();
    await settle(fixture);

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage.mock.calls[0]?.[0]).toMatchObject({
      conversationId: null,
      platformAccountId: ACCOUNT_ID,
      researchMode: 'SURPRISE_ME',
    });
    expect(navigate).toHaveBeenCalledWith(['/workspace', CONVERSATION_B]);
  });

  it.each([
    ['INCOMPLETE', 'Conclua o perfil'],
    ['INFERENCE_PENDING', 'Aguarde a inferência'],
    ['REVIEW_REQUIRED', 'Revise o perfil'],
  ] as const)('keeps trends unavailable for backend readiness %s', async (profileReadiness, reason) => {
    selected.set({ ...ACCOUNT, profileReadiness, trendGenerationAvailable: false,
      trendGenerationUnavailableReason: reason });
    accounts.set([selected() as PlatformAccount]);
    const fixture = await createFixture();
    await switchToSurprise(fixture);
    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector<HTMLButtonElement>('.surprise-composer .submit-button');
    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute('aria-disabled')).toBe('true');
    expect(host.textContent).toContain(reason);
    button?.click();
    expect(createRequest).not.toHaveBeenCalled();
  });

  it('updates trend availability when the backend-selected account changes', async () => {
    const blocked = { ...ACCOUNT, id: '00000000-0000-4000-8000-000000000102',
      profileReadiness: 'REVIEW_REQUIRED' as const, trendGenerationAvailable: false,
      trendGenerationUnavailableReason: 'Revise o perfil' };
    accounts.set([ACCOUNT, blocked]);
    const fixture = await createFixture();
    await switchToSurprise(fixture);
    selected.set(blocked);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.surprise-composer .submit-button')?.disabled)
      .toBe(true);
  });

  it('uses backend availability without deriving readiness from profile fields', async () => {
    selected.set({ ...ACCOUNT, profileConfigured: false, profileReadiness: 'READY',
      trendGenerationAvailable: true, trendGenerationUnavailableReason: null });
    accounts.set([selected() as PlatformAccount]);
    const fixture = await createFixture();
    await switchToSurprise(fixture);
    expect((fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.surprise-composer .submit-button')?.disabled)
      .toBe(false);
  });

  it('renders compact history from latest report title and generation date without technical metadata', async () => {
    const item = { ...summary(CONVERSATION_A, 'Título da conversa', '2026-07-29T10:00:00Z'),
      latestReportTitle: 'Spring: produtividade com leveza',
      latestReportGeneratedAt: '2026-07-30T04:04:00Z' };
    list.mockReturnValue(of([item]));
    const fixture = await createFixture();
    const historyItem = (fixture.nativeElement as HTMLElement).querySelector('.conversation-sidebar nav a');
    expect(historyItem?.textContent).toContain('Spring: produtividade com leveza');
    expect(historyItem?.textContent).toContain('Canal HAVK');
    expect(historyItem?.textContent).not.toContain('YOUTUBE');
    expect(historyItem?.textContent).not.toMatch(/provider|modelo|versão|modo/i);
  });

  it('falls back to the conversation title and marks the active item semantically', async () => {
    routeParams.next(convertToParamMap({ conversationId: CONVERSATION_A }));
    list.mockReturnValue(of([summary(CONVERSATION_A, 'Fallback da conversa', '2026-07-29T10:00:00Z')]));
    detail.mockReturnValue(of(conversationDetail(CONVERSATION_A, 'Fallback da conversa', 'Pedido')));
    const fixture = await createFixture();
    const item = (fixture.nativeElement as HTMLElement).querySelector('.conversation-sidebar nav a');
    expect(item?.textContent).toContain('Fallback da conversa');
    expect(item?.getAttribute('aria-current')).toBe('page');
    expect(item?.textContent).toContain('Conversa atual');
  });

  it('consumes global semantic tokens and exposes both modes as accessible tabs', async () => {
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const styles = Array.from(document.querySelectorAll('style'), (item) => item.textContent ?? '').join('\n');
    expect(styles).toContain('var(--havk-primary)');
    expect(styles).toContain('var(--havk-bg)');
    const modeTabs = host.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(modeTabs).toHaveLength(2);
    expect(Array.from(modeTabs).every((tab) => tab.classList.contains('research-mode-tab'))).toBe(true);
    expect(Array.from(modeTabs).every((tab) => !tab.classList.contains('conversation-toggle'))).toBe(true);
    const modePanel = host.querySelector('.research-mode-panel');
    expect(modePanel?.textContent).not.toContain('Modo de pesquisa');
    expect(modePanel?.textContent).not.toContain('O que você quer pesquisar?');
    expect(modePanel?.querySelector('.research-mode-selector')?.getAttribute('data-active')).toBe('SEARCH');
    expect(host.querySelectorAll('.research-mode-tab.is-active')).toHaveLength(1);
    expect(host.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.textContent)
      .toContain('Pesquisar');
    expect(host.querySelector<HTMLTextAreaElement>('#workspace-message')?.labels?.length).toBe(1);
    const conversationToggle = host.querySelector<HTMLButtonElement>('.conversation-toggle');
    expect(conversationToggle?.querySelector('.editorial-options-icon')).not.toBeNull();
    expect(conversationToggle?.getAttribute('aria-label')).toBe('Abrir opções editoriais');
    expect(conversationToggle?.getAttribute('aria-expanded')).toBe('false');
    conversationToggle?.click();
    fixture.detectChanges();
    expect(conversationToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('.conversation-sidebar')?.classList.contains('is-open')).toBe(true);
    const sidebarClose = host.querySelector<HTMLButtonElement>('.conversation-sidebar-close');
    expect(sidebarClose?.getAttribute('aria-label')).toBe('Fechar conversas');
    expect(host.querySelector('.conversation-sidebar')?.contains(sidebarClose ?? null)).toBe(true);
    expect(host.querySelector('.conversation-sidebar-backdrop')).not.toBeNull();
    sidebarClose?.click();
    fixture.detectChanges();
    expect(conversationToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.conversation-sidebar')?.classList.contains('is-open')).toBe(false);
    expect(host.querySelector('.conversation-sidebar-backdrop')).toBeNull();
  });

  async function createFixture(): Promise<ComponentFixture<WorkspacePage>> {
    const fixture = TestBed.createComponent(WorkspacePage);
    fixture.detectChanges();
    await settle(fixture);
    return fixture;
  }

  async function settle(fixture: ComponentFixture<WorkspacePage>): Promise<void> {
    await fixture.whenStable();
    for (let turn = 0; turn < 12; turn += 1) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  }

  async function startNewConversation(fixture: ComponentFixture<WorkspacePage>): Promise<void> {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.sidebar-heading button')?.click();
    await settle(fixture);
  }

  async function switchToSurprise(fixture: ComponentFixture<WorkspacePage>): Promise<void> {
    const tabs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]');
    Array.from(tabs).find((tab) => tab.textContent?.includes('Me surpreenda'))?.click();
    await settle(fixture);
  }

  async function switchToSearch(fixture: ComponentFixture<WorkspacePage>): Promise<void> {
    const tabs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]');
    Array.from(tabs).find((tab) => tab.textContent?.includes('Pesquisar'))?.click();
    await settle(fixture);
  }

  function fillComposer(fixture: ComponentFixture<WorkspacePage>, message: string): void {
    const host = fixture.nativeElement as HTMLElement;
    setValue(host.querySelector<HTMLTextAreaElement>('#workspace-message'), message);
    fixture.detectChanges();
  }

  function setValue(element: HTMLInputElement | HTMLTextAreaElement | null, value: string): void {
    if (!element) throw new Error('Campo esperado não encontrado.');
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function submitComposer(fixture: ComponentFixture<WorkspacePage>): void {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form.composer')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  function sidebarTitles(fixture: ComponentFixture<WorkspacePage>): string[] {
    return Array.from((fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLElement>('.conversation-sidebar nav a strong'),
      (item) => item.textContent?.trim() ?? '');
  }

  function activeConversation(fixture: ComponentFixture<WorkspacePage>): HTMLElement | null {
    return fixture.nativeElement.querySelector('.conversation-sidebar nav a.is-current');
  }
});

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000101';
const CONVERSATION_A = '00000000-0000-4000-8000-000000000201';
const CONVERSATION_B = '00000000-0000-4000-8000-000000000202';
const REQUEST_ID = '00000000-0000-4000-8000-000000000301';
const REPORT_ID = '00000000-0000-4000-8000-000000000501';

const AUTHENTICATED_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Vitor',
  email: 'vitor@example.com',
  status: 'ACTIVE' as const,
  createdAt: '2026-07-29T08:00:00Z',
  updatedAt: '2026-07-29T08:00:00Z',
};

const ACCOUNT: PlatformAccount = {
  id: ACCOUNT_ID,
  platformCode: 'YOUTUBE',
  platformName: 'YOUTUBE',
  displayName: 'Canal HAVK',
  handle: '@havk',
  externalIdentifier: 'havk-channel',
  publicUrl: null,
  description: null,
  language: 'pt-BR',
  region: 'BR',
  dataOrigin: 'SIMULATED',
  connectionStatus: 'CONNECTED',
  archived: false,
  primaryAccount: true,
  archivedAt: null,
  profileConfigured: true,
  profileReadiness: 'READY',
  trendGenerationAvailable: true,
  trendGenerationUnavailableReason: null,
  healthAvailability: 'AVAILABLE',
  lastSynchronizedAt: '2026-07-29T09:00:00Z',
  capabilities: {
    code: 'YOUTUBE', displayName: 'YouTube', manualRegistration: true, oauth: true,
    synchronization: true, automaticInference: true, health: true, analytics: true,
    futurePublishing: false, contentCapabilities: [],
  },
};

function summary(id: string, title: string, updatedAt: string): ReportConversationSummary {
  return {
    id,
    platformAccountId: ACCOUNT_ID,
    platformCode: 'YOUTUBE',
    accountDisplayName: 'Canal HAVK',
    accountHandle: '@havk',
    title,
    latestReportTitle: null,
    latestReportGeneratedAt: null,
    status: 'ACTIVE',
    hasActiveRequest: false,
    createdAt: '2026-07-29T09:00:00Z',
    updatedAt,
    archivedAt: null,
    researchMode: 'SEARCH',
  };
}
function conversationDetail(id: string, title: string, text: string): ReportConversationDetail {
  return {
    conversation: summary(id, title, id === CONVERSATION_B ? '2026-07-29T12:00:00Z' : '2026-07-29T11:00:00Z'),
    entries: [{
      id: id === CONVERSATION_B
        ? '00000000-0000-4000-8000-000000000402' : '00000000-0000-4000-8000-000000000401',
      entryType: 'USER_REQUEST', sequence: 1, displayText: text,
      reportRequestId: null, reportId: null, trendSearchId: null, metadata: {},
      createdAt: '2026-07-29T11:00:00Z',
    }],
    requests: [],
    reports: [],
  };
}

function processingDetail(): ReportConversationDetail {
  const base = conversationDetail(CONVERSATION_A, 'Em geração', 'Solicitação enviada');
  return {
    ...base,
    conversation: { ...base.conversation, hasActiveRequest: true },
    entries: [{ ...base.entries[0], reportRequestId: REQUEST_ID }],
    requests: [{
      requestId: REQUEST_ID,
      conversationId: CONVERSATION_A,
      status: 'GENERATING_REPORT',
      processingStep: 'GENERATING_REPORT',
      generationMode: 'USER_DIRECTED',
    }],
  };
}

function failedDiagnosticDetail(): ReportConversationDetail {
  const message = 'Não foi possível validar o roteiro gerado. Etapa: JSON_PARSE. Violações: MALFORMED_JSON.';
  const base = conversationDetail(CONVERSATION_A, 'Falha diagnosticada', message);
  return {
    ...base,
    entries: [{
      ...base.entries[0],
      entryType: 'ERROR',
      reportRequestId: REQUEST_ID,
    }],
    requests: [{
      requestId: REQUEST_ID,
      conversationId: CONVERSATION_A,
      status: 'FAILED',
      processingStep: 'FAILED',
      generationMode: 'USER_DIRECTED',
      failureCategory: 'INVALID_RESPONSE',
      failureCode: 'INVALID_AI_RESPONSE',
      failureMessage: message,
    }],
  };
}

function processingDetailFor(id: string, generationMode: 'AUTOMATIC_TREND_DISCOVERY'): ReportConversationDetail {
  const base = conversationDetail(id, 'Descoberta de oportunidade', 'Gerar conteúdo com tendências atuais sobre meu canal');
  return {
    ...base,
    conversation: { ...base.conversation, hasActiveRequest: true },
    entries: [{ ...base.entries[0], reportRequestId: REQUEST_ID }],
    requests: [{ requestId: REQUEST_ID, conversationId: id, status: 'QUEUED', generationMode }],
  };
}

function reportConversationDetail(simulated: boolean): ReportConversationDetail {
  return {
    conversation: summary(CONVERSATION_A, 'Conversa com relatório', '2026-07-29T12:00:00Z'),
    entries: [],
    requests: [{
      requestId: REQUEST_ID,
      conversationId: CONVERSATION_A,
      platformAccountId: ACCOUNT_ID,
      status: 'COMPLETED',
      reportId: REPORT_ID,
      completedAt: '2026-07-29T11:59:00Z',
    }],
    reports: [report(simulated)],
  };
}

function report(simulated: boolean): ReportDetailResponse {
  return {
    id: REPORT_ID,
    requestId: REQUEST_ID,
    conversationId: CONVERSATION_A,
    platformAccountId: ACCOUNT_ID,
    platformCode: 'YOUTUBE',
    platformHandle: '@havk',
    channelId: null,
    channelName: 'Canal HAVK',
    requestedTopic: 'IA responsável',
    objective: 'Explicar com clareza',
    title: 'Relatório carregado do aggregate',
    summary: 'Resumo editorial persistido.',
    methodology: 'HOOK_PROBLEM_SOLUTION_DIFFERENTIATOR',
    generationMode: 'USER_DIRECTED',
    simulated,
    providerVersion: 'fake-v1',
    provider: 'fake',
    model: 'fake-report-generation',
    reportVersion: 3,
    lineageRootReportId: REPORT_ID,
    contextSufficiency: 'SUFFICIENT',
    contextConfidence: .9,
    recommendedFormat: 'Vídeo de 8 minutos',
    dataCollectedAt: null,
    generatedAt: '2026-07-29T12:00:00Z',
    createdAt: '2026-07-29T12:00:00Z',
    ideas: [],
    sources: [],
    sections: [{
      key: 'HOOK', content: 'Gancho', purpose: null, reasoning: null, impact: null,
      context: null, consequence: null, relationship: null, expectedOutcome: null,
      variations: [], keyPoints: [], evidence: [],
    }],
    trends: [],
  };
}

function reportV3(): ReportDetailResponse {
  const base = report(false);
  const section = (key: string, startSecond: number, endSecond: number, transition: string | null, script: string) => ({
    key, content: `Editorial ${key}`, purpose: null, reasoning: null, impact: null, context: null,
    consequence: null, relationship: null, expectedOutcome: null, variations: [], keyPoints: [], evidence: [],
    spokenScript: script, transitionToNextSection: transition, modelEstimatedSeconds: endSecond - startSecond,
    calculatedSpeechSeconds: endSecond - startSecond, estimatedSpeechSeconds: endSecond - startSecond,
    estimatedSpeechLabel: `0:${String(endSecond - startSecond).padStart(2, '0')}`, startSecond, endSecond,
    deliveryNotes: 'Tom natural.', structuredEvidence: [],
  });
  return { ...base, recommendedFormat: 'SHORT_FORM', scriptContractVersion: 'report-contract-v3',
    schemaVersion: 'report-contract-v3', promptVersion: 'spoken-script-adaptive-v3',
    totalEstimatedDurationSeconds: 55, totalEstimatedDurationLabel: '0:55', estimatedWordCount: 145,
    speakingRateWordsPerMinute: 165, formatDecision: { format: 'SHORT_FORM', reason: 'Melhor retenção.',
      confidence: .86, metricsUsed: ['retenção'], limitations: [], targetDurationSeconds: 55 },
    evidenceSummary: [], sections: [
      section('HOOK', 0, 7, 'Agora conectamos o problema.', 'Texto falado do gancho.'),
      section('PROBLEM', 7, 17, 'A solução começa aqui.', 'Texto falado do problema.'),
      section('SOLUTION', 17, 45, 'O diferencial fecha a ideia.', 'Texto falado da solução.'),
      section('DIFFERENTIATOR', 45, 55, null, 'Texto falado do diferencial.'),
    ] };
}

function messageResponse(conversationId: string, requestId: string | null): WorkspaceMessageResponse {
  return {
    messageId: '00000000-0000-4000-8000-000000000601',
    conversationId,
    requestId,
    clarificationRequired: false,
    clarificationQuestion: null,
    interpretation: {
      generationMode: 'USER_DIRECTED',
      subject: 'Spring Boot',
      objective: 'Ensinar automação',
      additionalInstructions: null,
      useCurrentTrends: false,
      automaticDiscovery: false,
      confidence: .9,
      clarificationRequired: false,
      clarificationQuestion: null,
      interpretedLanguage: 'pt-BR',
      providerReference: 'fake-workspace-message-interpretation',
      modelReference: 'deterministic-rules-v1',
      simulated: true,
    },
    researchMode: 'SEARCH',
    outcome: 'RESEARCH_STARTED',
    assistantMessage: 'Pesquisa iniciada.',
  };
}
