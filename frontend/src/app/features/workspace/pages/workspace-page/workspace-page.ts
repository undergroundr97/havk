import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField, maxLength, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, firstValueFrom } from 'rxjs';

import { AuthSessionStore } from '../../../../core/auth/auth-session.store';
import { apiErrorMessage } from '../../../../core/http/api-error-message';
import { PlatformAccountContextStore } from '../../../platform-accounts/data-access/platform-account-context.store';
import {
  isFinalReportRequestStatus,
  ReportRequestResponse,
} from '../../../report-generation/data-access/report-generation.models';
import { ReportDetailResponse } from '../../../reports/data-access/report.models';
import { isReportIdentifier } from '../../../reports/data-access/report-response.parser';
import { ReportService } from '../../../reports/data-access/report.service';
import { formatReportDate } from '../../../report-viewer/report-date';
import {
  ConversationEntry,
  EMPTY_WORKSPACE_COMPOSER,
  ReportConversationDetail,
  ReportConversationSummary,
  ResearchMode,
  WorkspaceComposerModel,
} from '../../data-access/workspace.models';
import { composeWorkspaceFeed } from '../../data-access/workspace-feed';
import { WorkspaceExecutionTracker } from '../../data-access/workspace-execution-tracker.service';
import {
  normalizeResearchMode,
  WorkspaceSessionIdentity,
  WorkspaceSessionStore,
} from '../../data-access/workspace-session.store';
import { WorkspaceService } from '../../data-access/workspace.service';

type WorkspaceStatus = 'loading' | 'ready' | 'empty' | 'submitting' | 'error';

const PROCESSING_ORDER = [
  'QUEUED', 'DISCOVERING_CONTENT', 'SELECTING_CONTENT', 'ANALYZING_CONTENT',
  'FINDING_OPPORTUNITIES', 'BUILDING_STRATEGY', 'GENERATING_REPORT', 'COMPLETED',
] as const;

@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [FormField, RouterLink],
  templateUrl: './workspace-page.html',
  styleUrl: './workspace-page.scss',
})
export class WorkspacePage implements OnInit {
  private readonly auth = inject(AuthSessionStore);
  private readonly accounts = inject(PlatformAccountContextStore);
  private readonly workspace = inject(WorkspaceService);
  private readonly sessions = inject(WorkspaceSessionStore);
  private readonly executionTracker = inject(WorkspaceExecutionTracker);
  private readonly reportsService = inject(ReportService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private routeSequence = 0;

  protected readonly status = signal<WorkspaceStatus>(this.hasReadySessionCache() ? 'ready' : 'loading');
  protected readonly message = signal<string | null>(null);
  protected readonly conversations = computed(() => this.activeAccountMatchesSession()
    ? this.sessions.visibleConversations() : []);
  protected readonly detail = computed(() => this.activeAccountMatchesSession()
    ? this.sessions.detail() : null);
  protected readonly selectedConversationId = computed(() => this.activeAccountMatchesSession()
    ? this.sessions.selectedConversationId() : null);
  protected readonly conversationLoading = computed(() => this.activeAccountMatchesSession()
    && this.sessions.conversationLoading());
  protected readonly conversationError = computed(() => this.activeAccountMatchesSession()
    ? this.sessions.conversationError() : null);
  protected readonly lastValidConversationLoadedAt = signal<string | null>(null);
  protected readonly sidebarOpen = signal(false);
  protected readonly trackingWarning = computed(() => this.activeAccountMatchesSession()
    ? this.sessions.trackingWarning() : null);
  protected readonly newUpdatesAvailable = signal(false);
  protected readonly refinementReportId = signal<string | null>(null);
  protected readonly actionMessage = signal<string | null>(null);
  protected readonly activeResearchMode = this.sessions.activeResearchMode;
  protected readonly isSubmitting = signal(false);
  protected readonly submissionKind = signal<'message' | 'trends' | null>(null);
  protected readonly account = this.accounts.selected;
  protected readonly availableAccounts = this.accounts.accounts;
  protected readonly formatDate = formatReportDate;
  protected readonly feedViewport = viewChild<ElementRef<HTMLElement>>('feedViewport');
  protected readonly composerTextarea = viewChild<ElementRef<HTMLTextAreaElement>>('composerTextarea');

  protected readonly composerModel = signal<WorkspaceComposerModel>({ ...EMPTY_WORKSPACE_COMPOSER });
  protected readonly composerForm = form(this.composerModel, (fields) => {
    maxLength(fields.message, 4000, { message: 'Use no máximo 4000 caracteres.' });
  });

  protected readonly refinementModel = signal({ additionalInstructions: '' });
  protected readonly refinementForm = form(this.refinementModel, (fields) => {
    required(fields.additionalInstructions, { message: 'Informe a orientação da nova versão.' });
    maxLength(fields.additionalInstructions, 2000, { message: 'Use no máximo 2000 caracteres.' });
  });

  protected readonly entries = computed(() => this.detail()?.entries ?? []);
  protected readonly requests = computed(() => this.detail()?.requests ?? []);
  protected readonly reports = computed(() => this.detail()?.reports ?? []);
  protected readonly activeRequest = computed(() =>
    [...this.requests()].reverse().find((request) => !isFinalReportRequestStatus(request.status)) ?? null,
  );
  protected readonly activeReportRequest = this.activeRequest;
  protected readonly semanticChatPending = computed(() =>
    this.isSubmitting() && this.activeResearchMode() === 'SEARCH');
  protected readonly waitingClarification = computed(() => this.entries().some((entry) =>
    entry.entryType === 'INFORMATION' && entry.metadata['clarification'] === true)
    && this.activeRequest() === null);
  protected readonly progress = computed(() => this.activeRequest()?.progressPercent ?? 0);
  protected readonly finalResult = computed(() => this.reports().at(-1) ?? null);
  protected readonly currentConversation = computed(() => this.detail()?.conversation ?? null);
  protected readonly feedItems = computed(() => {
    const detail = this.detail();
    return detail ? composeWorkspaceFeed(detail) : [];
  });
  protected readonly feedEntries = computed<readonly ConversationEntry[]>(() =>
    this.feedItems().map((item) => {
      if (item.kind === 'entry') return item.entry;
      return {
        id: item.kind === 'request' ? item.request.requestId : item.report.id,
        entryType: item.kind === 'request' ? 'SYSTEM_PROGRESS' : 'REPORT_RESULT',
        sequence: item.sequence,
        displayText: '',
        reportRequestId: item.kind === 'request' ? item.request.requestId : null,
        reportId: item.kind === 'report' ? item.report.id : null,
        trendSearchId: null,
        metadata: {},
        createdAt: item.occurredAt,
      } satisfies ConversationEntry;
    }),
  );
  protected readonly hasFeedData = computed(() => this.feedItems().length > 0);
  protected readonly trimmedMessage = computed(() => this.composerModel().message.trim());
  protected readonly conversationAvailable = computed(() => Boolean(this.account())
    && this.status() !== 'loading' && this.status() !== 'empty'
    && !this.conversationLoading()
    && (!this.selectedConversationId() || this.currentConversation()?.id === this.selectedConversationId()));
  protected readonly isBusy = computed(() => this.isSubmitting() || this.activeRequest() !== null);
  protected readonly canSend = computed(() => this.activeResearchMode() === 'SEARCH'
    && this.trimmedMessage().length > 0
    && !this.isSubmitting() && this.activeRequest() === null && this.conversationAvailable());
  protected readonly canGenerateTrends = computed(() => this.activeResearchMode() === 'SURPRISE_ME'
    && Boolean(this.account()?.trendGenerationAvailable)
    && !this.isSubmitting() && this.activeRequest() === null && this.conversationAvailable());
  protected readonly trendUnavailableReason = computed(() =>
    this.account()?.trendGenerationUnavailableReason
      ?? 'Conclua a configuração e a revisão do perfil desta conta para gerar conteúdo com tendências atuais.');

  async ngOnInit(): Promise<void> {
    if (!await this.loadBase()) return;
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(([params, query]) => {
      const sequence = ++this.routeSequence;
      void this.openRoute(params.get('conversationId'), query.get('mode'), sequence);
    });
  }

  protected requestFor(entry: ConversationEntry): ReportRequestResponse | null {
    if (entry.entryType !== 'SYSTEM_PROGRESS' || !entry.reportRequestId) return null;
    const item = this.feedItems().find((candidate) =>
      candidate.kind === 'request' && candidate.request.requestId === entry.reportRequestId);
    return item?.kind === 'request' ? item.request : null;
  }

  protected reportFor(entry: ConversationEntry): ReportDetailResponse | null {
    if (!entry.reportId) return null;
    const item = this.feedItems().find((candidate) =>
      candidate.kind === 'report' && candidate.report.id === entry.reportId);
    return item?.kind === 'report' ? item.report : null;
  }

  protected feedEntryKey(entry: ConversationEntry): string {
    if (entry.entryType === 'REPORT_RESULT' && entry.reportId === entry.id) return `report:${entry.id}`;
    if (entry.entryType === 'SYSTEM_PROGRESS' && entry.reportRequestId === entry.id) {
      return `request:${entry.id}`;
    }
    return `entry:${entry.id}`;
  }

  protected async submitRequest(event: Event): Promise<void> {
    event.preventDefault();
    const account = this.account();
    const originalMessage = this.composerModel().message;
    const naturalMessage = originalMessage.trim();
    if (!account || !this.canSend() || !naturalMessage) return;
    this.isSubmitting.set(true);
    this.submissionKind.set('message');
    this.status.set('submitting');
    this.message.set(null);
    this.sessions.clearActiveFeedback();
    let acceptedByBackend = false;
    await submit(this.composerForm, {
      onInvalid: () => {
        this.isSubmitting.set(false);
        this.submissionKind.set(null);
        this.status.set('error');
        this.message.set('Revise os campos destacados antes de enviar.');
      },
      action: async () => {
        try {
          const messageId = this.document.defaultView?.crypto.randomUUID();
          if (!messageId) throw new Error('Não foi possível identificar a mensagem.');
          const accepted = await firstValueFrom(this.workspace.sendMessage({
            messageId,
            platformAccountId: account.id,
            conversationId: this.compatibleConversationId(this.activeResearchMode()),
            message: naturalMessage,
            researchMode: this.activeResearchMode(),
          }));
          acceptedByBackend = true;
          this.composerModel.set({ ...EMPTY_WORKSPACE_COMPOSER });
          this.resetComposerTextarea();
          this.focusComposer();
          if (accepted.conversationId === this.selectedConversationId()) {
            await this.refreshAcceptedConversation(accepted.conversationId);
          } else if (!await this.router.navigate(['/workspace', accepted.conversationId])) {
            throw new Error('Não foi possível abrir a conversa criada.');
          }
        } catch (error: unknown) {
          if (!acceptedByBackend) this.composerModel.set({ message: originalMessage });
          this.status.set('error');
          this.message.set(apiErrorMessage(error, 'Não foi possível enviar a mensagem.'));
        } finally {
          this.isSubmitting.set(false);
          this.submissionKind.set(null);
        }
      },
    });
  }

  protected async generateWithCurrentTrends(): Promise<void> {
    const account = this.account();
    if (!account || !this.canGenerateTrends()) return;
    this.isSubmitting.set(true);
    this.submissionKind.set('trends');
    this.status.set('submitting');
    this.message.set(null);
    this.actionMessage.set('Iniciando pesquisa e ranking de tendências para esta conta…');
    try {
      const messageId = this.document.defaultView?.crypto.randomUUID();
      if (!messageId) throw new Error('Não foi possível identificar a pesquisa.');
      const accepted = await firstValueFrom(this.workspace.sendMessage({
        messageId,
        platformAccountId: account.id,
        conversationId: this.compatibleConversationId('SURPRISE_ME'),
        message: 'Me surpreenda com base no meu canal.',
        researchMode: 'SURPRISE_ME',
      }));
      const conversationId = accepted.conversationId;
      if (!conversationId) throw new Error('A solicitação não retornou uma conversa válida.');
      if (conversationId === this.selectedConversationId()) {
        await this.refreshAcceptedConversation(conversationId);
      } else if (!await this.router.navigate(['/workspace', conversationId])) {
        throw new Error('Não foi possível abrir a conversa criada.');
      }
    } catch (error: unknown) {
      this.status.set('error');
      this.message.set(apiErrorMessage(error, 'Não foi possível iniciar a geração com tendências atuais.'));
    } finally {
      this.isSubmitting.set(false);
      this.submissionKind.set(null);
    }
  }

  protected processingLabel(request: ReportRequestResponse): string {
    if (request.progressMessage) return request.progressMessage;
    switch (request.processingStep ?? request.status) {
      case 'QUEUED': return 'Pedido recebido.';
      case 'WAITING_FOR_COLLECTION_SLOT':
        return 'Outra coleta desta conta está em andamento. Sua pesquisa foi mantida na fila e iniciará em seguida.';
      case 'DISCOVERING_CONTENT': return 'Buscando conteúdos relevantes para sua pesquisa.';
      case 'SELECTING_CONTENT': return 'Selecionando os melhores conteúdos para análise.';
      case 'ANALYZING_CONTENT': return 'Estamos avaliando as melhores oportunidades.';
      case 'FINDING_OPPORTUNITIES': return 'Comparando padrões, recorrência e desempenho.';
      case 'BUILDING_STRATEGY': return 'Transformando as oportunidades em uma estratégia.';
      case 'GENERATING_REPORT': return 'Preparando sua ideia e roteiro.';
      case 'COMPLETED': return 'Relatório concluído';
      case 'NO_RELEVANT_OPPORTUNITY':
        return 'Nenhuma oportunidade suficientemente relevante foi encontrada para esta pesquisa e período.';
      case 'FAILED': return 'Não foi possível concluir a análise.';
      case 'CANCELLED': return 'Solicitação cancelada';
      default: return request.status;
    }
  }

  protected processingProgress(request: ReportRequestResponse): number {
    if (request.progressPercent !== undefined) return request.progressPercent;
    const step = request.processingStep ?? request.status;
    const index = PROCESSING_ORDER.indexOf(step as (typeof PROCESSING_ORDER)[number]);
    return index < 0 ? 0 : Math.round(((index + 1) / PROCESSING_ORDER.length) * 100);
  }

  protected shouldShowFailureMessage(entry: ConversationEntry, request: ReportRequestResponse): boolean {
    return request.status === 'FAILED'
      && !!request.failureMessage
      && request.failureMessage !== entry.displayText
      && !this.entries().some((candidate) => candidate.entryType === 'ERROR'
        && candidate.reportRequestId === request.requestId
        && candidate.displayText === request.failureMessage);
  }

  protected handleComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (this.canSend()) void this.submitRequest(event);
  }

  protected async startNewConversation(): Promise<void> {
    this.sidebarOpen.set(false);
    this.sessions.clearActiveSelection();
    await this.router.navigate(['/workspace'], {
      queryParams: { mode: this.activeResearchMode() },
    });
  }

  protected switchResearchMode(mode: ResearchMode): void {
    if (mode === this.activeResearchMode()) return;
    this.sidebarOpen.set(false);
    const userId = this.auth.user()?.id;
    const accountId = this.account()?.id;
    if (!userId || !accountId) return;
    this.sessions.activate({ userId, platformAccountId: accountId, researchMode: mode });
  }

  protected beginConversationSelection(id: string): void {
    if (id === this.selectedConversationId()) {
      this.sidebarOpen.set(false);
      return;
    }
    const userId = this.auth.user()?.id;
    const summary = userId ? this.sessions.findConversation(userId, id) : null;
    if (userId && summary) {
      this.sessions.activate({
        userId,
        platformAccountId: summary.platformAccountId,
        researchMode: this.activeResearchMode(),
      }, id);
    }
    this.sidebarOpen.set(false);
  }

  protected async archiveConversation(): Promise<void> {
    const conversation = this.currentConversation();
    if (!conversation || this.activeRequest()) return;
    try {
      await firstValueFrom(this.workspace.archive(conversation.id));
      const userId = this.auth.user()?.id;
      if (userId) this.sessions.removeConversation(userId, conversation.id);
      await this.router.navigate(['/workspace'], {
        queryParams: { mode: this.activeResearchMode() },
      });
    } catch (error: unknown) {
      this.actionMessage.set(apiErrorMessage(error, 'Não foi possível arquivar a conversa.'));
    }
  }

  protected openRefinement(reportId: string): void {
    this.refinementReportId.set(reportId);
    this.refinementModel.set({ additionalInstructions: '' });
  }

  protected cancelRefinement(): void { this.refinementReportId.set(null); }

  protected async submitRefinement(event: Event): Promise<void> {
    event.preventDefault();
    const reportId = this.refinementReportId();
    if (!reportId || this.isBusy()) return;
    await submit(this.refinementForm, {
      action: async () => {
        this.status.set('submitting');
        try {
          await firstValueFrom(this.reportsService.regenerateReport(
            reportId, this.refinementModel().additionalInstructions.trim(),
          ));
          this.refinementReportId.set(null);
          const conversation = this.currentConversation();
          if (conversation) await this.refreshAcceptedConversation(conversation.id);
        } catch (error: unknown) {
          this.status.set('error');
          this.message.set(apiErrorMessage(error, 'Não foi possível criar a nova versão.'));
        }
      },
    });
  }

  protected async copyReport(report: ReportDetailResponse): Promise<void> {
    const sections = (report.sections ?? []).map((section) => {
      const transition = section.transitionToNextSection ? `\nTransição: ${section.transitionToNextSection}` : '';
      return `${this.sectionTitle(section.key)}\n${section.spokenScript ?? section.content}${transition}`;
    }).join('\n\n');
    try {
      await this.document.defaultView?.navigator.clipboard.writeText(
        `${report.title}\n\n${report.summary}\n\n${sections}`,
      );
      this.actionMessage.set('Relatório copiado.');
    } catch {
      this.actionMessage.set('Não foi possível copiar automaticamente. Abra o relatório completo para selecionar o texto.');
    }
  }

  protected sectionTitle(key: string): string {
    return ({ HOOK: 'Gancho', PROBLEM: 'Problema', SOLUTION: 'Solução', DIFFERENTIATOR: 'Diferencial' })[key] ?? key;
  }

  protected formatName(value: string | null | undefined): string {
    return ({ SHORT_FORM: 'Vídeo curto', STANDARD_VIDEO: 'Vídeo tradicional', LONG_FORM: 'Vídeo longo',
      LIVE: 'Live', OTHER: 'Outro formato' } as Record<string, string>)[value ?? ''] ?? value ?? 'Não definido';
  }

  protected timelineLabel(start: number | null | undefined, end: number | null | undefined): string {
    if (start === null || start === undefined || end === null || end === undefined) return '';
    const label = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    return `${label(start)}–${label(end)}`;
  }

  protected entryLabel(entry: ConversationEntry): string {
    switch (entry.entryType) {
      case 'USER_REQUEST': return 'Você';
      case 'USER_REFINEMENT': return 'Seu refinamento';
      case 'TREND_DISCOVERY': return 'Descoberta de tendências';
      case 'TREND_SELECTION': return 'Oportunidade editorial';
      case 'REPORT_RESULT': return 'Relatório HAVK';
      case 'WARNING': return 'Atenção';
      case 'ERROR': return 'Falha';
      case 'SYSTEM_PROGRESS': return 'Processamento';
      case 'INFORMATION': return 'HAVK';
    }
  }

  protected isNoRelevantTrend(entry: ConversationEntry): boolean {
    return entry.entryType === 'WARNING' && entry.metadata['code'] === 'NO_RELEVANT_TREND';
  }

  protected conversationTitle(conversation: ReportConversationSummary): string {
    return conversation.latestReportTitle ?? conversation.title ?? 'Nova conversa';
  }

  protected conversationDate(conversation: ReportConversationSummary): string {
    return conversation.latestReportGeneratedAt ?? conversation.updatedAt ?? conversation.createdAt;
  }

  protected resizeComposerTextarea(event: Event): void {
    const textarea = event.target;
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    textarea.style.height = 'auto';
    const height = Math.min(Math.max(textarea.scrollHeight, 42), 210);
    textarea.style.height = `${height}px`;
    textarea.style.overflowY = textarea.scrollHeight > 210 ? 'auto' : 'hidden';
  }

  protected handleFeedScroll(event: Event): void {
    const viewport = event.target;
    if (viewport instanceof HTMLElement && this.isNearFeedEnd(viewport)) {
      this.newUpdatesAvailable.set(false);
    }
  }

  protected showLatestUpdate(): void {
    this.scrollFeedToEnd(true);
  }

  protected confidence(value: number | undefined): string {
    return `${Math.round((value ?? 0) * 100)}%`;
  }

  private async loadBase(): Promise<boolean> {
    if (!this.hasReadySessionCache()) this.status.set('loading');
    try {
      const userId = this.auth.user()?.id;
      if (!userId) throw new Error('Authenticated workspace session is unavailable.');
      await this.accounts.load();
      const conversations = await this.sessions.ensureConversationList(userId);
      if (!this.account()) {
        const lastAccountId = conversations[0]?.platformAccountId;
        const preferred = this.availableAccounts().find((candidate) => candidate.id === lastAccountId)
          ?? this.availableAccounts().find((candidate) => candidate.primaryAccount)
          ?? (this.availableAccounts().length === 1 ? this.availableAccounts()[0] : undefined);
        if (preferred) this.accounts.select(preferred.id);
      }
      this.status.set(this.account() ? 'ready' : 'empty');
      return true;
    } catch (error: unknown) {
      this.status.set('error');
      this.message.set(apiErrorMessage(error, 'Não foi possível carregar o workspace.'));
      return false;
    }
  }

  private async openRoute(id: string | null, rawMode: string | null, sequence: number): Promise<void> {
    const userId = this.auth.user()?.id;
    const account = this.account();
    if (!userId || !account) return;
    this.message.set(null);
    this.newUpdatesAvailable.set(false);
    if (id === null) {
      const mode = parseResearchMode(rawMode) ?? 'SEARCH';
      this.sessions.activate({ userId, platformAccountId: account.id, researchMode: mode }, null);
      this.status.set('ready');
      return;
    }
    if (!isReportIdentifier(id)) {
      this.sessions.activate({
        userId,
        platformAccountId: account.id,
        researchMode: parseResearchMode(rawMode) ?? 'SEARCH',
      }, id);
      this.sessions.setInvalidConversation('O identificador da conversa é inválido.');
      this.status.set('error');
      return;
    }
    const summary = this.sessions.findConversation(userId, id);
    const hasActiveAccountSession = this.sessions.activePlatformAccountId() === summary?.platformAccountId;
    let identity: WorkspaceSessionIdentity = summary ? {
      userId,
      platformAccountId: summary.platformAccountId,
      researchMode: parseResearchMode(rawMode)
        ?? (hasActiveAccountSession ? this.activeResearchMode() : normalizeResearchMode(summary.researchMode)),
    } : {
      userId,
      platformAccountId: account.id,
      researchMode: parseResearchMode(rawMode) ?? this.activeResearchMode(),
    };
    if (summary && this.availableAccounts().some((candidate) => candidate.id === summary.platformAccountId)) {
      this.accounts.select(summary.platformAccountId);
    }
    this.sessions.activate(identity, id);
    const shouldFollowLatest = this.detail() === null || this.isFeedNearEnd();
    try {
      const detail = await this.sessions.loadConversation(identity, id);
      if (sequence !== this.routeSequence) return;
      identity = {
        userId,
        platformAccountId: detail.conversation.platformAccountId,
        researchMode: identity.researchMode,
      };
      if (this.availableAccounts().some((candidate) => candidate.id === identity.platformAccountId)) {
        this.accounts.select(identity.platformAccountId);
      }
      this.sessions.activate(identity, id);
      this.status.set('ready');
      this.lastValidConversationLoadedAt.set(new Date().toISOString());
      this.ensureActiveTrackers(identity, detail);
      this.followLatestAfterUpdate(shouldFollowLatest);
    } catch {
      if (sequence === this.routeSequence && !this.detail()) this.status.set('error');
    }
  }

  private async refreshAcceptedConversation(conversationId: string): Promise<void> {
    const identity = this.activeIdentity();
    if (!identity) return;
    const detail = await this.sessions.loadConversation(identity, conversationId, true);
    this.ensureActiveTrackers(identity, detail);
    this.status.set('ready');
  }

  private ensureActiveTrackers(identity: WorkspaceSessionIdentity, detail: ReportConversationDetail): void {
    for (const request of detail.requests) {
      if (isFinalReportRequestStatus(request.status)) continue;
      this.executionTracker.ensure(request.requestId, {
        ...identity,
        researchMode: normalizeResearchMode(detail.conversation.researchMode),
        conversationId: detail.conversation.id,
      });
    }
  }

  private activeIdentity(): WorkspaceSessionIdentity | null {
    const userId = this.auth.user()?.id;
    const accountId = this.account()?.id;
    if (!userId || !accountId) return null;
    return { userId, platformAccountId: accountId, researchMode: this.activeResearchMode() };
  }

  private compatibleConversationId(mode: ResearchMode): string | null {
    const conversation = this.currentConversation();
    if (!conversation || normalizeResearchMode(conversation.researchMode) !== mode) return null;
    return conversation.id;
  }

  private hasReadySessionCache(): boolean {
    const userId = this.auth.user()?.id;
    return Boolean(userId && this.accounts.selected() && this.sessions.isConversationListLoaded(userId));
  }

  private activeAccountMatchesSession(): boolean {
    return this.accounts.selected()?.id === this.sessions.activePlatformAccountId();
  }

  private focusComposer(): void {
    this.document.defaultView?.setTimeout(() => {
      this.composerTextarea()?.nativeElement.focus();
    });
  }

  private resetComposerTextarea(): void {
    const textarea = this.composerTextarea()?.nativeElement;
    if (!textarea) return;
    textarea.style.height = '42px';
    textarea.style.overflowY = 'hidden';
  }

  private isFeedNearEnd(): boolean {
    const viewport = this.feedViewport()?.nativeElement;
    return viewport === undefined || this.isNearFeedEnd(viewport);
  }

  private isNearFeedEnd(viewport: HTMLElement): boolean {
    return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 120;
  }

  private followLatestAfterUpdate(shouldFollowLatest: boolean): void {
    if (shouldFollowLatest) this.scrollFeedToEnd(false);
    else this.newUpdatesAvailable.set(true);
  }

  private scrollFeedToEnd(force: boolean): void {
    this.document.defaultView?.requestAnimationFrame(() => {
      const viewport = this.feedViewport()?.nativeElement;
      if (!viewport) return;
      const view = this.document.defaultView;
      const reducedMotion = typeof view?.matchMedia === 'function'
        && view.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (typeof viewport.scrollTo === 'function') {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: force && !reducedMotion ? 'smooth' : 'auto',
        });
      } else {
        viewport.scrollTop = viewport.scrollHeight;
      }
      this.newUpdatesAvailable.set(false);
    });
  }

}

function parseResearchMode(value: string | null): ResearchMode | null {
  return value === 'SEARCH' || value === 'SURPRISE_ME' ? value : null;
}
