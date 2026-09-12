import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { DashboardResponse } from '../../data-access/dashboard.models';
import { InvalidDashboardResponseError } from '../../data-access/dashboard.parser';
import { DashboardService } from '../../data-access/dashboard.service';
import { DashboardPage } from './dashboard-page';
import { PlatformAccountContextStore } from '../../../platform-accounts/data-access/platform-account-context.store';
import { platformAccountContextStub } from '../../../platform-accounts/testing/platform-account-context.stub';

describe('DashboardPage', () => {
  const getDashboard = vi.fn();
  let result: Subject<DashboardResponse>;

  beforeEach(() => {
    result = new Subject<DashboardResponse>();
    getDashboard.mockReset();
    getDashboard.mockReturnValue(result);
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        { provide: DashboardService, useValue: { getDashboard } },
        { provide: PlatformAccountContextStore, useFactory: platformAccountContextStub },
      ],
    });
  });

  it('shows loading, greeting, one main action, journey, summary and real recent reports', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Preparando sua visão geral');

    result.next(dashboard());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Olá, Criadora HAVK');
    expect(fixture.nativeElement.textContent).toContain('Pronto para uma nova ideia?');
    expect(fixture.nativeElement.querySelectorAll('.recommended-action .primary-action')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Conta criada');
    expect(fixture.nativeElement.textContent).toContain('Canal cadastrado');
    expect(fixture.nativeElement.textContent).toContain('Relatório recente');
    expect(fixture.nativeElement.textContent).toContain('Saúde do canal');
    expect(fixture.nativeElement.textContent).toContain('SIMULATED · Dados simulados');
    expect(fixture.nativeElement.textContent).toContain('Rotina sustentável');
    expect(fixture.nativeElement.querySelectorAll('.health-card')).toHaveLength(7);
    expect(fixture.nativeElement.textContent).not.toContain('Canal conectado');
    expect(fixture.nativeElement.textContent).not.toContain('inscritos');
    expect(fixture.nativeElement.querySelector('a[href="/relatorios/00000000-0000-4000-8000-000000000020"]')).not.toBeNull();
  });

  it('presents an actionable empty state without inventing data or a name', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    result.next(emptyDashboard());
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent?.trim()).toBe('Olá');
    expect(fixture.nativeElement.textContent).toContain('Você ainda não possui relatórios.');
    expect(fixture.nativeElement.querySelector('a[href="/relatorios/novo"]')).not.toBeNull();
  });

  it('keeps valid sections visible in the documented partial state and allows retry', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    result.next({ ...dashboard(), recentReports: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('relatórios recentes não puderam');
    expect(fixture.nativeElement.textContent).toContain('Seu HAVK hoje');
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.partial-notice button')?.click();
    expect(getDashboard).toHaveBeenCalledTimes(2);
  });

  it('shows an active request without starting polling and links to the existing tracking screen', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    const requestId = '00000000-0000-4000-8000-000000000031';
    result.next({
      ...dashboard(),
      activeRequest: {
        requestId,
        status: 'GENERATING_REPORT',
        processingStep: 'GENERATING_REPORT',
        requestedTopic: 'Angular',
        createdAt: '2026-07-22T12:06:00Z',
        updatedAt: '2026-07-22T12:07:00Z',
      },
      recommendedAction: {
        type: 'FOLLOW_ACTIVE_REQUEST',
        title: 'Acompanhe seu conteúdo em criação',
        description: 'O relatório continua sendo processado.',
        target: `/relatorios/novo?solicitacao=${requestId}`,
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Gerando ideias');
    expect(fixture.nativeElement.textContent).toContain('segundo plano');
    expect(fixture.nativeElement.querySelector(`a[href="/relatorios/novo?solicitacao=${requestId}"]`)).not.toBeNull();
    expect(getDashboard).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid payloads as an error and offers a safe retry', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    result.error(new InvalidDashboardResponseError('invalid'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('dados recebidos');
    fixture.nativeElement.querySelector('button')?.click();
    expect(getDashboard).toHaveBeenCalledTimes(2);
  });
});

function dashboard(): DashboardResponse {
  return {
    user: { name: 'Criadora HAVK' },
    platformAccount: {
      id: '00000000-0000-4000-8000-000000000003', platformCode: 'YOUTUBE',
      displayName: 'Canal HAVK', handle: '@havk',
      connectionStatus: 'CONNECTED', archived: false,
    },
    onboarding: {
      accountCreated: true,
      profileConfigured: true,
      channelRegistered: true,
      firstReportGenerated: true,
      channel: { id: '00000000-0000-4000-8000-000000000003', name: 'Canal HAVK' },
    },
    reports: { totalReports: 1, totalIdeas: 3, lastGeneratedAt: '2026-07-22T12:05:00Z' },
    recentReports: [
      {
        id: '00000000-0000-4000-8000-000000000020',
        requestId: '00000000-0000-4000-8000-000000000021',
        platformAccountId: '00000000-0000-4000-8000-000000000003',
        platformCode: 'YOUTUBE',
        platformHandle: '@havk',
        channelId: '00000000-0000-4000-8000-000000000003',
        title: 'Relatório recente',
        summary: 'Resumo seguro.',
        generatedAt: '2026-07-22T12:05:00Z',
        createdAt: '2026-07-22T12:05:01Z',
        channelName: 'Canal HAVK',
        requestedTopic: 'Angular',
        requestedIdeaCount: 3,
        status: 'COMPLETED',
      },
    ],
    activeRequest: null,
    recommendedAction: {
      type: 'GENERATE_REPORT',
      title: 'Pronto para uma nova ideia?',
      description: 'Gere novas oportunidades.',
      target: '/relatorios/novo',
    },
    youtube: null,
    channelHealth: completeHealth(),
    profileReview: null,
  };
}
function emptyDashboard(): DashboardResponse {
  return {
    user: { name: null },
    platformAccount: null,
    onboarding: {
      accountCreated: true,
      profileConfigured: false,
      channelRegistered: false,
      firstReportGenerated: false,
      channel: null,
    },
    reports: { totalReports: 0, totalIdeas: 0, lastGeneratedAt: null },
    recentReports: [],
    activeRequest: null,
    recommendedAction: {
      type: 'CONFIGURE_PROFILE',
      title: 'Complete seu perfil',
      description: 'Informe seu contexto.',
      target: '/perfil/onboarding',
    },
    youtube: null,
    channelHealth: emptyHealth(),
    profileReview: null,
  };
}

function completeHealth(): DashboardResponse['channelHealth'] {
  const insight = (value: string): NonNullable<DashboardResponse['channelHealth']['bestDay']> => ({
    value, explanation: 'Estimativa histórica; não é garantia.', criterion: 'Critério transparente',
    confidence: { score: .75, level: 'MEDIUM' }, insufficientData: false,
  });
  return {
    status: 'SUCCESS', source: 'SIMULATED', simulated: true, analyzedAt: '2026-07-28T12:00:00Z',
    publicationFrequency: insight('1 vídeo por semana'), consistency: insight('Consistência excelente'),
    highestEngagement: insight('Rotina sustentável'), peakRetention: insight('78%'),
    bestDay: insight('Quarta-feira'), bestTime: insight('09h–11h'),
    bestFormat: insight('SHORT_FORM_VIDEO, conforme a amostra observada'),
  };
}

function emptyHealth(): DashboardResponse['channelHealth'] {
  return { status: 'EMPTY', source: null, simulated: false, analyzedAt: null, publicationFrequency: null,
    consistency: null, highestEngagement: null, peakRetention: null, bestDay: null, bestTime: null, bestFormat: null };
}
