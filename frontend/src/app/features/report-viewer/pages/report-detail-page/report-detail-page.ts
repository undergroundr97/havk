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
import { Subscription } from 'rxjs';

import { isApiError } from '../../../../core/http/api-error.model';
import {
  ReportDetailResponse,
  ReportSourceResponse,
  VideoIdeaResponse,
} from '../../../reports/data-access/report.models';
import {
  InvalidReportResponseError,
  isReportIdentifier,
} from '../../../reports/data-access/report-response.parser';
import {
  reportDeletionFailure,
  ReportDeletionFailure,
} from '../../../reports/data-access/report-deletion-error';
import { ReportService } from '../../../reports/data-access/report.service';
import { ReportDeleteDialog } from '../../../reports/components/report-delete-dialog/report-delete-dialog';
import { ReportIdeaCard } from '../../components/report-idea-card/report-idea-card';
import { ReportSourceList } from '../../components/report-source-list/report-source-list';
import { formatReportDate } from '../../report-date';

type ReportErrorKind =
  'invalid-id' | 'not-found' | 'forbidden' | 'session' | 'network' | 'invalid-response' | 'unknown';

type ReportDetailViewState =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'success' | 'empty'; readonly report: ReportDetailResponse }
  | {
      readonly status: 'error';
      readonly kind: ReportErrorKind;
      readonly message: string;
      readonly canRetry: boolean;
    };

interface IdeaPresentation {
  readonly idea: VideoIdeaResponse;
  readonly sources: readonly ReportSourceResponse[];
}

type DetailDeletionState =
  | { readonly status: 'idle' }
  | { readonly status: 'confirming' | 'deleting'; readonly report: ReportDetailResponse }
  | {
      readonly status: 'error';
      readonly report: ReportDetailResponse;
      readonly failure: ReportDeletionFailure;
    }
  | { readonly status: 'success'; readonly message: string };

@Component({
  selector: 'app-report-detail-page',
  standalone: true,
  imports: [RouterLink, ReportIdeaCard, ReportSourceList, ReportDeleteDialog],
  templateUrl: './report-detail-page.html',
  styleUrl: './report-detail-page.scss',
})
export class ReportDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reportService = inject(ReportService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageHeading = viewChild<ElementRef<HTMLHeadingElement>>('pageHeading');
  private readonly reportId = signal<string | null>(null);
  private loadSubscription: Subscription | null = null;

  protected readonly state = signal<ReportDetailViewState>({ status: 'idle' });
  protected readonly deletionState = signal<DetailDeletionState>({ status: 'idle' });
  protected readonly regenerationState = signal<'idle' | 'submitting' | 'error'>('idle');
  protected readonly regenerationError = signal<string | null>(null);
  protected readonly report = computed(() => {
    const current = this.state();
    return current.status === 'success' || current.status === 'empty' ? current.report : null;
  });
  protected readonly error = computed(() => {
    const current = this.state();
    return current.status === 'error' ? current : null;
  });
  protected readonly ideaPresentations = computed<readonly IdeaPresentation[]>(() => {
    const report = this.report();
    if (!report) return [];
    const sources = orderSources(report.sources);
    return orderIdeas(report.ideas).map((idea) => ({
      idea,
      sources: sources.filter((source) => source.videoIdeaId === idea.id),
    }));
  });
  protected readonly generalSources = computed(() => {
    const report = this.report();
    return report
      ? orderSources(report.sources).filter((source) => source.videoIdeaId === null)
      : [];
  });
  protected readonly structuredSections = computed(() => this.report()?.sections ?? []);
  protected readonly isScriptV3 = computed(() => this.report()?.scriptContractVersion === 'report-contract-v3');
  protected readonly traceableTrends = computed(() => this.report()?.trends ?? []);
  protected readonly formatDate = formatReportDate;
  protected readonly selectedReportForDeletion = computed(() => {
    const current = this.deletionState();
    return current.status === 'confirming' ||
      current.status === 'deleting' ||
      current.status === 'error'
      ? current.report
      : null;
  });
  protected readonly deletionError = computed(() => {
    const current = this.deletionState();
    return current.status === 'error' ? current.failure : null;
  });
  protected readonly deletionAnnouncement = computed(() => {
    const current = this.deletionState();
    return current.status === 'success' ? current.message : null;
  });

  private readonly focusCompletedState = effect(() => {
    const status = this.state().status;
    const heading = this.pageHeading();
    if (status !== 'idle' && status !== 'loading' && heading) {
      heading.nativeElement.focus();
    }
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const identifier = params.get('reportId');
      this.loadSubscription?.unsubscribe();
      this.loadSubscription = null;

      if (!isReportIdentifier(identifier)) {
        this.reportId.set(null);
        this.state.set({
          status: 'error',
          kind: 'invalid-id',
          message: 'O identificador do relatório é inválido.',
          canRetry: false,
        });
        return;
      }

      this.reportId.set(identifier);
      this.load(identifier);
    });
  }

  protected retry(): void {
    const identifier = this.reportId();
    if (identifier && this.state().status !== 'loading') {
      this.load(identifier);
    }
  }

  protected beginDelete(): void {
    const report = this.report();
    if (report && this.deletionState().status === 'idle') {
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
      current.status === 'success' ||
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
        next: () => this.finishDeletion(false),
        error: (error: unknown) => {
          const failure = reportDeletionFailure(error);
          if (failure.kind === 'already-absent') {
            this.finishDeletion(true);
            return;
          }
          this.deletionState.set({ status: 'error', report, failure });
        },
      });
  }

  protected regenerate(): void {
    const report = this.report();
    if (!report || this.regenerationState() === 'submitting') return;
    this.regenerationState.set('submitting');
    this.regenerationError.set(null);
    this.reportService.regenerateReport(report.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (request) => {
        const conversationId = request.conversationId ?? report.conversationId;
        if (conversationId) {
          void this.router.navigate(['/workspace', conversationId]);
        } else {
          void this.router.navigate(['/relatorios/novo'], { queryParams: { solicitacao: request.requestId } });
        }
      },
      error: (error: unknown) => {
        this.regenerationState.set('error');
        this.regenerationError.set(
          error instanceof HttpErrorResponse && isApiError(error.error)
            ? error.error.message
            : 'Não foi possível criar uma nova versão do relatório.',
        );
      },
    });
  }

  protected sectionTitle(key: string): string {
    switch (key) {
      case 'HOOK': return 'Gancho';
      case 'PROBLEM': return 'Problema';
      case 'SOLUTION': return 'Solução';
      case 'DIFFERENTIATOR': return 'Diferencial';
      case 'OPENING_QUESTION': return 'Pergunta inicial';
      case 'SHORT_ANSWER': return 'Resposta curta';
      case 'CONTEXT': return 'Contexto';
      case 'EXPLANATION': return 'Explicação';
      case 'COUNTERPOINT': return 'Contraponto';
      case 'CONCLUSION': return 'Conclusão';
      case 'COLD_OPEN': return 'Abertura fria';
      case 'SETUP': return 'Preparação';
      case 'INCITING_EVENT': return 'Evento inicial';
      case 'DEVELOPMENT': return 'Desenvolvimento';
      case 'TURNING_POINT': return 'Ponto de virada';
      case 'RESOLUTION': return 'Resolução';
      case 'TAKEAWAY': return 'Aprendizado';
      case 'OPENING': return 'Abertura';
      case 'ITEMS': return 'Itens';
      case 'SYNTHESIS': return 'Síntese';
      default: return key;
    }
  }

  protected formatName(value: string | null | undefined): string {
    return ({
      SHORT_FORM: 'Vídeo curto',
      STANDARD_VIDEO: 'Vídeo tradicional',
      LONG_FORM: 'Vídeo longo',
      LIVE: 'Live',
      OTHER: 'Outro formato',
    } as Record<string, string>)[value ?? ''] ?? value ?? 'Não definido';
  }

  protected timelineLabel(start: number | null | undefined, end: number | null | undefined): string {
    if (start === null || start === undefined || end === null || end === undefined) return '';
    return `${this.secondsLabel(start)}–${this.secondsLabel(end)}`;
  }

  protected secondsLabel(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  protected evidenceTypeLabel(value: string): string {
    return ({
      SOURCE_FACT: 'Fonte externa',
      CONTENT_HISTORY_FACT: 'Histórico do canal',
      ACCOUNT_METRIC: 'Métrica da conta',
      HAVK_CALCULATION: 'Cálculo HAVK',
      HAVK_RECOMMENDATION: 'Recomendação HAVK',
    } as Record<string, string>)[value] ?? value;
  }

  protected isError(kind: ReportErrorKind): boolean {
    const current = this.state();
    return current.status === 'error' && current.kind === kind;
  }

  private load(identifier: string): void {
    this.state.set({ status: 'loading' });
    this.loadSubscription = this.reportService
      .getReport(identifier)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.loadSubscription = null;
          this.state.set({
            status: report.ideas.length === 0 && (report.sections?.length ?? 0) === 0 ? 'empty' : 'success',
            report,
          });
        },
        error: (error: unknown) => {
          this.loadSubscription = null;
          this.handleError(error);
        },
      });
  }

  private handleError(error: unknown): void {
    if (error instanceof InvalidReportResponseError) {
      this.setError(
        'invalid-response',
        'Os dados recebidos para este relatório são inválidos. Tente novamente.',
        true,
      );
      return;
    }

    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        this.setError('session', 'Sua sessão expirou. Entre novamente para continuar.', false);
        return;
      }
      if (error.status === 403) {
        this.setError('forbidden', 'Você não tem permissão para acessar este relatório.', false);
        return;
      }
      if (error.status === 404) {
        this.setError(
          'not-found',
          'O relatório não foi encontrado ou não está disponível para esta conta.',
          false,
        );
        return;
      }
      if (error.status === 0 || (isApiError(error.error) && error.error.code === 'NETWORK_ERROR')) {
        this.setError(
          'network',
          'Não foi possível conectar ao serviço para carregar o relatório.',
          true,
        );
        return;
      }
    }

    this.setError('unknown', 'Não foi possível carregar o relatório.', true);
  }

  private setError(kind: ReportErrorKind, message: string, canRetry: boolean): void {
    this.state.set({ status: 'error', kind, message, canRetry });
  }

  private finishDeletion(alreadyAbsent: boolean): void {
    const message = alreadyAbsent
      ? 'O relatório já não estava disponível. Retornando ao histórico.'
      : 'Relatório excluído com sucesso. Retornando ao histórico.';
    this.deletionState.set({ status: 'success', message });
    void this.router.navigate(['/relatorios'], {
      queryParams: { exclusao: alreadyAbsent ? 'ausente' : 'concluida' },
      replaceUrl: true,
    });
  }
}

function orderIdeas(ideas: readonly VideoIdeaResponse[]): readonly VideoIdeaResponse[] {
  return [...ideas].sort(
    (left, right) => left.position - right.position || left.id.localeCompare(right.id),
  );
}

function orderSources(sources: readonly ReportSourceResponse[]): readonly ReportSourceResponse[] {
  return [...sources].sort(
    (left, right) => left.position - right.position || left.id.localeCompare(right.id),
  );
}
