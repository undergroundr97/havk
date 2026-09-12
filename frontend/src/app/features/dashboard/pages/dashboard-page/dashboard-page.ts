import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, UrlTree } from '@angular/router';

import { apiErrorMessage } from '../../../../core/http/api-error-message';
import {
  DashboardActiveRequest,
  DashboardResponse,
} from '../../data-access/dashboard.models';
import { InvalidDashboardResponseError } from '../../data-access/dashboard.parser';
import { DashboardService } from '../../data-access/dashboard.service';
import { ChannelHealthGrid } from '../../components/channel-health-grid/channel-health-grid';
import { PlatformAccountContextStore } from '../../../platform-accounts/data-access/platform-account-context.store';
import { PlatformAccountSelector } from '../../../platform-accounts/components/platform-account-selector/platform-account-selector';

type DashboardStatus = 'idle' | 'loading' | 'success' | 'empty' | 'partial' | 'error';

interface DashboardViewState {
  readonly status: DashboardStatus;
  readonly data: DashboardResponse | null;
  readonly message: string | null;
  readonly canRetry: boolean;
}

interface JourneyStep {
  readonly label: string;
  readonly complete: boolean;
  readonly guidance: string;
  readonly target: string | null;
}

interface QuickAction {
  readonly label: string;
  readonly description: string;
  readonly target: string;
}

const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [RouterLink, ChannelHealthGrid, PlatformAccountSelector],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly accountContext = inject(PlatformAccountContextStore);

  protected readonly state = signal<DashboardViewState>({
    status: 'idle',
    data: null,
    message: null,
    canRetry: false,
  });
  protected readonly data = computed(() => this.state().data);
  protected readonly journey = computed<readonly JourneyStep[]>(() => {
    const onboarding = this.data()?.onboarding;
    const profileReview = this.data()?.profileReview;
    if (!onboarding) return [];
    const profileComplete = onboarding.profileConfigured && (
      !profileReview || profileReview.status === 'CONFIRMED' || profileReview.status === 'MANUAL'
    );
    return [
      {
        label: 'Conta criada',
        complete: onboarding.accountCreated,
        guidance: 'Sua conta HAVK está pronta.',
        target: null,
      },
      {
        label: 'Perfil configurado',
        complete: profileComplete,
        guidance: profileComplete
          ? 'Seu contexto de criação está disponível.'
          : 'Informe seu nicho, público e objetivos.',
        target: profileReview?.target ?? (onboarding.profileConfigured ? '/perfil' : '/perfil/onboarding'),
      },
      {
        label: 'Canal cadastrado',
        complete: onboarding.channelRegistered,
        guidance: onboarding.channelRegistered
          ? `Canal cadastrado: ${onboarding.channel?.name ?? 'disponível'}.`
          : 'Cadastre manualmente seu canal nesta etapa.',
        target: onboarding.channelRegistered ? '/canal' : '/canal/novo',
      },
      {
        label: 'Primeiro relatório gerado',
        complete: onboarding.firstReportGenerated,
        guidance: onboarding.firstReportGenerated
          ? 'Seu histórico de ideias já começou.'
          : 'Gere conteúdo quando perfil e canal estiverem prontos.',
        target: onboarding.firstReportGenerated ? '/relatorios' : '/relatorios/novo',
      },
    ];
  });
  protected readonly quickActions = computed<readonly QuickAction[]>(() => {
    const data = this.data();
    if (!data) return [];
    const actions: QuickAction[] = [
      {
        label: data.profileReview ? 'Revisar perfil'
          : data.onboarding.profileConfigured ? 'Editar perfil' : 'Configurar perfil',
        description: 'Ajuste o contexto usado para personalizar suas ideias.',
        target: data.profileReview?.target
          ?? (data.onboarding.profileConfigured ? '/perfil' : '/perfil/onboarding'),
      },
      {
        label: data.onboarding.channelRegistered ? 'Ver canal cadastrado' : 'Cadastrar canal',
        description: 'Consulte ou informe o canal usado no fluxo atual.',
        target: data.onboarding.channelRegistered ? '/canal' : '/canal/novo',
      },
    ];
    if (data.onboarding.profileConfigured && data.onboarding.channelRegistered) {
      actions.push({
        label: 'Gerar conteúdo',
        description: 'Crie um relatório com novas oportunidades de vídeo.',
        target: '/relatorios/novo',
      });
    }
    if (data.reports.totalReports > 0) {
      actions.push({
        label: 'Relatórios passados',
        description: 'Retome ideias que já foram geradas.',
        target: '/relatorios',
      });
    }
    return actions;
  });

  ngOnInit(): void {
    this.state.set({ status: 'loading', data: null, message: null, canRetry: false });
    void this.initialize();
  }

  protected accountChanged(): void { this.load(); }

  protected retry(): void {
    if (this.state().canRetry) this.load();
  }

  protected formatDate(value: string): string {
    return DATE_FORMAT.format(new Date(value));
  }

  protected formatNumber(value:number|null):string{return value===null?'Não disponível':value.toLocaleString('pt-BR');}

  protected requestStatus(request: DashboardActiveRequest): string {
    switch (request.status) {
      case 'QUEUED':
        return 'Na fila';
      case 'DISCOVERING_CONTENT':
        return 'Coletando tendências';
      case 'SELECTING_CONTENT':
        return 'Selecionando conteúdos';
      case 'ANALYZING_CONTENT':
        return 'Analisando oportunidades';
      case 'FINDING_OPPORTUNITIES':
        return 'Comparando oportunidades';
      case 'BUILDING_STRATEGY':
        return 'Montando a estratégia';
      case 'GENERATING_REPORT':
        return 'Gerando ideias';
    }
  }

  protected actionLink(target: string): UrlTree {
    return this.router.parseUrl(target);
  }

  private load(): void {
    this.state.set({ status: 'loading', data: this.state().data, message: null, canRetry: false });
    this.dashboardService
      .getDashboard(this.accountContext.selectedId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const status: DashboardStatus = data.recentReports === null
            ? 'partial'
            : data.reports.totalReports === 0 && data.activeRequest === null
              ? 'empty'
              : 'success';
          this.state.set({
            status,
            data,
            message: status === 'partial'
              ? 'O resumo está disponível, mas os relatórios recentes não puderam ser apresentados.'
              : null,
            canRetry: status === 'partial',
          });
        },
        error: (error: unknown) => this.handleError(error),
      });
  }

  private async initialize(): Promise<void> {
    if (this.accountContext.status() === 'idle' || this.accountContext.status() === 'loading') {
      await this.accountContext.load();
    }
    if (this.accountContext.status() === 'selection-required') {
      this.state.set({ status: 'empty', data: null, message: 'Selecione uma conta para abrir o dashboard.', canRetry: false });
      return;
    }
    this.load();
  }

  private handleError(error: unknown): void {
    const message = error instanceof InvalidDashboardResponseError
      ? 'Os dados recebidos para o dashboard são inválidos. Tente novamente.'
      : error instanceof HttpErrorResponse && error.status === 403
        ? 'Você não tem permissão para acessar este dashboard.'
        : apiErrorMessage(error, 'Não foi possível carregar seu dashboard.');
    const canRetry =
      error instanceof InvalidDashboardResponseError ||
      !(error instanceof HttpErrorResponse) ||
      error.status === 0 ||
      error.status >= 500;
    this.state.set({ status: 'error', data: null, message, canRetry });
  }
}
