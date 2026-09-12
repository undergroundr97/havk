import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';

import { apiErrorMessage } from '../../../../core/http/api-error-message';
import { PlatformAccountContextStore } from '../../../platform-accounts/data-access/platform-account-context.store';
import { PlatformAccountSelector } from '../../../platform-accounts/components/platform-account-selector/platform-account-selector';
import {
  EMPTY_REPORT_GENERATION_FORM,
  formModelToCreateReportRequest,
  isFinalReportRequestStatus,
  ReportGenerationFormModel,
  ReportGenerationStrategy,
  ReportPollingEvent,
  ReportRequestResponse,
  ReportRequestStatus,
} from '../../data-access/report-generation.models';
import { ReportGenerationService } from '../../data-access/report-generation.service';
import { isReportIdentifier } from '../../../reports/data-access/report-response.parser';

type ViewStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'processing'
  | 'completed'
  | 'no-relevant'
  | 'failed'
  | 'cancelled'
  | 'empty'
  | 'error';

interface ReportGenerationViewState {
  readonly status: ViewStatus;
  readonly message: string | null;
  readonly canRetryLoad?: boolean;
}

interface ProcessingStep {
  readonly status: ProcessingStage;
  readonly label: string;
}

type ProcessingStage = Exclude<
  ReportRequestStatus,
  'COMPLETED' | 'NO_RELEVANT_OPPORTUNITY' | 'FAILED' | 'CANCELLED'
>;
type TrackingState = 'TRACKING_ACTIVE' | 'TRACKING_UNSTABLE' | 'TRACKING_PAUSED';

const MAX_CONSECUTIVE_POLLING_ERRORS = 5;

const PROCESSING_STEPS: readonly ProcessingStep[] = [
  { status: 'QUEUED', label: 'Pedido recebido' },
  { status: 'DISCOVERING_CONTENT', label: 'Buscando conteúdos relevantes' },
  { status: 'SELECTING_CONTENT', label: 'Selecionando os melhores conteúdos' },
  { status: 'ANALYZING_CONTENT', label: 'Avaliando oportunidades' },
  { status: 'FINDING_OPPORTUNITIES', label: 'Comparando padrões e desempenho' },
  { status: 'BUILDING_STRATEGY', label: 'Montando a estratégia' },
  { status: 'GENERATING_REPORT', label: 'Preparando ideia e roteiro' },
];

@Component({
  selector: 'app-report-generation-page',
  standalone: true,
  imports: [FormField, RouterLink, PlatformAccountSelector],
  templateUrl: './report-generation-page.html',
  styleUrl: './report-generation-page.scss',
})
export class ReportGenerationPage implements OnInit {
  private readonly accountContext = inject(PlatformAccountContextStore);
  private readonly reportService = inject(ReportGenerationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private pollingSubscription: Subscription | null = null;
  private navigationStarted = false;

  protected readonly account = this.accountContext.selected;
  protected readonly activeRequestId = signal<string | null>(null);
  protected readonly processingStep = signal<ProcessingStage | null>(null);
  protected readonly trackingState = signal<TrackingState>('TRACKING_ACTIVE');
  protected readonly trackingWarning = signal<string | null>(null);
  protected readonly trackingError = signal<string | null>(null);
  protected readonly consecutivePollingErrors = signal(0);
  protected readonly lastSuccessfulPollAt = signal<Date | null>(null);
  protected readonly viewState = signal<ReportGenerationViewState>({
    status: 'idle',
    message: 'Preparando a geração…',
  });
  protected readonly processingSteps = PROCESSING_STEPS;
  protected readonly model = signal<ReportGenerationFormModel>({
    ...EMPTY_REPORT_GENERATION_FORM,
  });
  protected readonly reportForm = form(this.model, (report) => {
    validate(report.topic, ({ value }) => this.model().generationStrategy === 'TOPIC_GUIDED'
      && !String(value()).trim() ? { kind: 'required', message: 'Informe o assunto.' } : null);
    maxLength(report.topic, 200, { message: 'Use no máximo 200 caracteres.' });
    maxLength(report.objective, 500, { message: 'Use no máximo 500 caracteres.' });
    maxLength(report.instructions, 2000, { message: 'Use no máximo 2000 caracteres.' });
  });
  protected readonly isSubmitting = computed(() => this.viewState().status === 'submitting');
  protected readonly isProcessing = computed(() => this.viewState().status === 'processing');
  protected readonly isSubmissionActive = computed(() => this.isSubmitting() || this.isProcessing());
  protected readonly activeStepIndex = computed(() => {
    const processingStep = this.processingStep();
    return PROCESSING_STEPS.findIndex((step) => step.status === processingStep);
  });
  protected readonly submitActionLabel = computed(() => this.model().generationStrategy === 'TOPIC_GUIDED'
    ? 'Gerar ideias sobre este assunto' : 'Gerar com as melhores oportunidades');

  async ngOnInit(): Promise<void> {
    await this.loadAccounts();
    if (!this.account()) return;

    const strategy = this.route.snapshot.queryParamMap.get('strategy');
    if (strategy === 'SURPRISE_ME' || strategy === 'TOPIC_GUIDED') this.chooseStrategy(strategy);

    const requestId = this.route.snapshot.queryParamMap.get('solicitacao');
    if (requestId === null) return;
    if (!isReportIdentifier(requestId)) {
      this.viewState.set({
        status: 'error',
        message: 'A solicitação informada é inválida.',
      });
      return;
    }
    this.activeRequestId.set(requestId);
    this.viewState.set({ status: 'loading', message: 'Carregando sua solicitação…' });
    try {
      const request = await firstValueFrom(this.reportService.getRequest(requestId));
      this.handleSuccessfulPoll(request);
      if (!isFinalReportRequestStatus(request.status)) this.startPolling(request.requestId);
    } catch (error: unknown) {
      this.activeRequestId.set(null);
      this.viewState.set({
        status: 'error',
        message: apiErrorMessage(error, 'Não foi possível carregar a solicitação.'),
      });
    }
  }

  protected async submitReport(event: Event): Promise<void> {
    event.preventDefault();
    const account = this.account();
    if (this.isSubmitting() || this.isProcessing()) {
      return;
    }
    if (!account) return;

    this.stopPolling();
    this.activeRequestId.set(null);
    this.processingStep.set(null);
    this.resetTrackingSignals();
    this.navigationStarted = false;
    this.viewState.set({ status: 'submitting', message: 'Enviando solicitação' });

    await submit(this.reportForm, {
      onInvalid: () => {
        this.viewState.set({
          status: 'error',
          message: 'Revise os campos destacados antes de iniciar a geração.',
        });
      },
      action: async () => {
        try {
          const accepted = await firstValueFrom(
            this.reportService.createRequest(formModelToCreateReportRequest(this.model(), account.id)),
          );
          this.activeRequestId.set(accepted.requestId);
          this.processingStep.set(toProcessingStage(accepted.status) ?? 'QUEUED');
          this.viewState.set({
            status: 'processing',
            message: statusMessage(this.processingStep() ?? 'QUEUED'),
          });
          this.startPolling(accepted.requestId);
        } catch (error: unknown) {
          this.activeRequestId.set(null);
          this.processingStep.set(null);
          this.viewState.set({
            status: 'error',
            message: apiErrorMessage(error, 'Não foi possível iniciar a geração.'),
          });
        }
        return undefined;
      },
    });
  }

  protected async retryLoad(): Promise<void> {
    await this.loadAccounts(true);
  }

  protected accountChanged(): void {
    if (this.isSubmitting() || this.isProcessing()) return;
    this.stopPolling(); this.activeRequestId.set(null);
    this.processingStep.set(null);
    this.viewState.set({ status: 'ready', message: null });
  }

  protected chooseStrategy(strategy: ReportGenerationStrategy): void {
    if (this.isSubmissionActive()) return;
    this.model.update((value) => ({
      ...value,
      generationStrategy: strategy,
      topic: strategy === 'SURPRISE_ME' ? '' : value.topic,
    }));
  }

  protected retryPolling(): void {
    const requestId = this.activeRequestId();
    if (!requestId || !this.isProcessing() || this.trackingState() !== 'TRACKING_PAUSED') return;
    this.resetTrackingSignals();
    this.startPolling(requestId);
  }

  protected resetFlow(): void {
    this.stopPolling();
    this.activeRequestId.set(null);
    this.processingStep.set(null);
    this.resetTrackingSignals();
    this.navigationStarted = false;
    this.viewState.set({ status: 'ready', message: null });
  }

  protected stepState(index: number): 'completed' | 'active' | 'pending' {
    const activeIndex = this.activeStepIndex();
    if (index < activeIndex || this.viewState().status === 'completed') return 'completed';
    if (index === activeIndex) return 'active';
    return 'pending';
  }

  protected stepStateLabel(index: number): string {
    switch (this.stepState(index)) {
      case 'completed':
        return 'concluída';
      case 'active':
        return 'em andamento';
      case 'pending':
        return 'pendente';
    }
  }

  private async loadAccounts(force = false): Promise<void> {
    this.viewState.set({ status: 'loading', message: 'Carregando seu canal…' });
    try {
      await this.accountContext.load(force);
      if (this.account()) {
        this.viewState.set({ status: 'ready', message: null });
      } else {
        this.viewState.set({ status: 'empty', message: this.accountContext.status() === 'selection-required'
          ? 'Selecione explicitamente a conta de destino.'
          : 'Cadastre uma conta de plataforma antes de solicitar um relatório.' });
      }
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.viewState.set({
          status: 'empty',
          message: 'Cadastre um canal antes de solicitar um relatório.',
        });
        return;
      }
      this.viewState.set({
        status: 'error',
        message: apiErrorMessage(error, 'Não foi possível carregar seu canal.'),
        canRetryLoad: true,
      });
    }
  }

  private startPolling(requestId: string): void {
    this.stopPolling();
    this.trackingState.set('TRACKING_ACTIVE');
    this.pollingSubscription = this.reportService
      .watchRequest(requestId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => this.handlePollingEvent(event),
        error: (error: unknown) => {
          this.pollingSubscription = null;
          this.consecutivePollingErrors.set(MAX_CONSECUTIVE_POLLING_ERRORS - 1);
          this.handleTemporaryPollingFailure(error);
        },
        complete: () => {
          this.pollingSubscription = null;
        },
      });
  }

  private handlePollingEvent(event: ReportPollingEvent): void {
    if (event.kind === 'temporary-error') {
      this.handleTemporaryPollingFailure(event.error);
      return;
    }
    this.handleSuccessfulPoll(event.request);
  }

  private handleSuccessfulPoll(request: ReportRequestResponse): void {
    this.consecutivePollingErrors.set(0);
    this.trackingWarning.set(null);
    this.trackingError.set(null);
    this.lastSuccessfulPollAt.set(new Date());
    if (!isFinalReportRequestStatus(request.status)) {
      this.trackingState.set('TRACKING_ACTIVE');
    }
    this.handleRequestUpdate(request);
  }

  private handleTemporaryPollingFailure(_error: unknown): void {
    const failureCount = this.consecutivePollingErrors() + 1;
    this.consecutivePollingErrors.set(failureCount);
    if (failureCount >= MAX_CONSECUTIVE_POLLING_ERRORS) {
      this.trackingState.set('TRACKING_PAUSED');
      this.trackingWarning.set(null);
      this.trackingError.set(
        'O acompanhamento foi pausado após falhas consecutivas. Retome quando a conexão estabilizar.',
      );
      this.stopPolling();
      return;
    }
    this.trackingState.set(failureCount >= 3 ? 'TRACKING_UNSTABLE' : 'TRACKING_ACTIVE');
    this.trackingWarning.set(
      failureCount >= 3
        ? 'Conexão instável. Continuamos tentando acompanhar.'
        : 'Não foi possível atualizar o status agora. Tentando novamente',
    );
  }

  private handleRequestUpdate(request: ReportRequestResponse): void {
    const currentStep = toProcessingStage(request.processingStep ?? request.status);
    if (currentStep) this.processingStep.set(currentStep);
    switch (request.status) {
      case 'COMPLETED':
        this.stopPolling();
        if (!request.reportId) {
          this.viewState.set({
            status: 'error',
            message: 'O processamento terminou, mas o relatório retornado é inválido.',
          });
          return;
        }
        if (this.navigationStarted) return;
        this.navigationStarted = true;
        this.trackingWarning.set(null);
        this.trackingError.set(null);
        this.activeRequestId.set(null);
        this.viewState.set({ status: 'completed', message: 'Relatório concluído.' });
        void this.router.navigate(['/relatorios', request.reportId]);
        return;
      case 'FAILED':
        this.stopPolling();
        this.trackingWarning.set(null);
        this.trackingError.set(null);
        this.activeRequestId.set(null);
        this.viewState.set({
          status: 'failed',
          message: request.failureMessage ?? 'A geração não pôde ser concluída.',
        });
        return;
      case 'NO_RELEVANT_OPPORTUNITY':
        this.stopPolling();
        this.trackingWarning.set(null);
        this.trackingError.set(null);
        this.activeRequestId.set(null);
        this.viewState.set({
          status: 'no-relevant',
          message: 'Nenhuma oportunidade suficientemente relevante foi encontrada para esta pesquisa e período.',
        });
        return;
      case 'CANCELLED':
        this.stopPolling();
        this.trackingWarning.set(null);
        this.trackingError.set(null);
        this.activeRequestId.set(null);
        this.viewState.set({
          status: 'cancelled',
          message: 'Solicitação cancelada.',
        });
        return;
      default:
        this.viewState.set({
          status: 'processing',
          message: statusMessage(currentStep ?? request.status),
        });
    }
  }

  private stopPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = null;
  }

  private resetTrackingSignals(): void {
    this.consecutivePollingErrors.set(0);
    this.trackingState.set('TRACKING_ACTIVE');
    this.trackingWarning.set(null);
    this.trackingError.set(null);
    this.lastSuccessfulPollAt.set(null);
  }
}

function statusMessage(status: ProcessingStage): string {
  switch (status) {
    case 'QUEUED': return 'Pedido recebido.';
    case 'DISCOVERING_CONTENT': return 'Buscando conteúdos relevantes para sua pesquisa.';
    case 'SELECTING_CONTENT': return 'Selecionando os melhores conteúdos para análise.';
    case 'ANALYZING_CONTENT': return 'Estamos avaliando as melhores oportunidades.';
    case 'FINDING_OPPORTUNITIES': return 'Comparando padrões, recorrência e desempenho.';
    case 'BUILDING_STRATEGY': return 'Transformando as oportunidades em uma estratégia.';
    case 'GENERATING_REPORT': return 'Preparando sua ideia e roteiro.';
  }
}

function toProcessingStage(value: string | null | undefined): ProcessingStage | null {
  const normalized = value?.trim().toUpperCase();
  switch (normalized) {
    case 'QUEUED':
    case 'DISCOVERING_CONTENT':
    case 'SELECTING_CONTENT':
    case 'ANALYZING_CONTENT':
    case 'FINDING_OPPORTUNITIES':
    case 'BUILDING_STRATEGY':
    case 'GENERATING_REPORT':
      return normalized;
    default:
      return null;
  }
}
