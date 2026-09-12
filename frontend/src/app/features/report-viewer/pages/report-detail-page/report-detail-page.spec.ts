import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ApiError } from '../../../../core/http/api-error.model';
import { ReportDetailResponse } from '../../../reports/data-access/report.models';
import { InvalidReportResponseError } from '../../../reports/data-access/report-response.parser';
import { ReportService } from '../../../reports/data-access/report.service';
import { ReportDetailPage } from './report-detail-page';

describe('ReportDetailPage', () => {
  const getReport = vi.fn<(reportId: string) => Observable<ReportDetailResponse>>();
  const deleteReport = vi.fn<(reportId: string) => Observable<void>>();
  let routeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    routeParams = new BehaviorSubject(convertToParamMap({ reportId: REPORT_ID }));
    getReport.mockReset();
    deleteReport.mockReset();
    getReport.mockReturnValue(of(completeReport));
    deleteReport.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      imports: [ReportDetailPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: routeParams } },
        { provide: ReportService, useValue: { getReport, deleteReport } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('loads the route identifier once and exposes loading until the response arrives', () => {
    const response = new Subject<ReportDetailResponse>();
    getReport.mockReturnValue(response);
    const fixture = createFixture();

    expect(getReport).toHaveBeenCalledOnce();
    expect(getReport).toHaveBeenCalledWith(REPORT_ID);
    expect(fixture.nativeElement.textContent).toContain('Carregando relatório');
    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
    expect(response.observed).toBe(true);

    fixture.destroy();
    expect(response.observed).toBe(false);
  });

  it('renders the complete report and every required idea section as text', () => {
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Relatório completo de tendências');
    expect(text).toContain('Resumo acionável para o canal.');
    expect(text).toContain('Canal HAVK');
    expect(text).toContain('Angular Signals');
    expect(text).toContain('Público recomendado');
    expect(text).toContain('Justificativa de compatibilidade');
    expect(text).toContain('Tendência dois');
    expect(text).toContain('Observações dois');
    expect(text).toContain('Palavras-chave');
    expect(text).toContain('Riscos');
    expect(text).toContain('Limitações');

    const storyLabels = Array.from(
      host.querySelectorAll<HTMLElement>('.story-blocks h4'),
      (heading) => heading.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(storyLabels.slice(0, 4)).toEqual([
      'Gancho Hook',
      'Problema Problem',
      'Solução Solution',
      'Diferencial Differentiator',
    ]);
    expect(fixture.nativeElement.querySelector('[innerHTML]')).toBeNull();
  });

  it('renders report-contract-v3 as a spoken timeline with transitions and collapsed editorial details', () => {
    getReport.mockReturnValue(of({
      ...scriptReport,
      formatDecision: {
        ...scriptReport.formatDecision!,
        historicalAffinity: .86,
        historicalEvidenceCount: 8,
        alternatives: [
          { format: 'STANDARD_VIDEO', historicalAffinity: .71, confidence: .8,
            evidenceCount: 6, recentUsagePenalty: .2 },
        ],
      },
    }));
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(text).toContain('Vídeo curto');
    expect(text).toContain('0:55');
    expect(text).toContain('165 ppm');
    expect(text).toContain('Outros formatos compatíveis');
    expect(text).toContain('Vídeo tradicional');
    expect(text).toContain('71% de afinidade histórica');
    expect(text).toContain('Texto para falar');
    expect(text).toContain('Transição natural para o problema.');
    expect(text).toContain('0:00–0:07');
    expect(host.querySelectorAll('.spoken-script')).toHaveLength(4);
    expect(host.querySelectorAll('.editorial-details')).toHaveLength(4);
    expect(host.querySelector('.editorial-details')?.hasAttribute('open')).toBe(false);
  });

  it('renders variable narrative section labels without assuming HPS', () => {
    getReport.mockReturnValue(of({
      ...scriptReport,
      sections: [
        spokenSection('OPENING', 0, 7, 'Transição para o contexto.'),
        spokenSection('CONTEXT', 7, 17, 'Transição para os itens.'),
        spokenSection('ITEMS', 17, 45, 'Transição para a síntese.'),
        spokenSection('SYNTHESIS', 45, 50, 'Transição para a conclusão.'),
        spokenSection('CONCLUSION', 50, 55, null),
      ],
    }));
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const headings = Array.from(
      host.querySelectorAll<HTMLElement>('.script-section-heading h3'),
      (heading) => heading.textContent?.trim(),
    );

    expect(host.textContent).toContain('Estrutura narrativa do roteiro');
    expect(headings).toEqual(['Abertura', 'Contexto', 'Itens', 'Síntese', 'Conclusão']);
  });

  it('keeps semantically distinct idea cards visible alongside report-contract-v3 sections', () => {
    getReport.mockReturnValue(of({ ...scriptReport, ideas: completeReport.ideas }));
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.spoken-script')).toHaveLength(4);
    expect(host.querySelectorAll('app-report-idea-card')).toHaveLength(2);
    expect(host.textContent).toContain('Primeira ideia');
    expect(host.textContent).toContain('Segunda ideia');
  });

  it('omits nullable and optional fields when they are absent', () => {
    getReport.mockReturnValue(of(reportWithoutOptionals));
    const fixture = createFixture();
    const text = fixture.nativeElement.textContent;

    expect(text).not.toContain('Assunto solicitado');
    expect(text).not.toContain('Coleta concluída em');
    expect(text).not.toContain('Relevância');
    expect(text).not.toContain('Concorrência');
    expect(text).not.toContain('Urgência');
    expect(text).not.toContain('Palavras-chave');
    expect(text).not.toContain('Riscos');
    expect(text).not.toContain('Limitações');
    expect(text).not.toContain('Publicador');
    expect(text).not.toContain('Publicado em');
  });

  it('renders a controlled empty state for a valid report without ideas', () => {
    getReport.mockReturnValue(of({ ...reportWithoutOptionals, ideas: [], sources: [] }));
    const fixture = createFixture();

    expect(fixture.nativeElement.textContent).toContain('Nenhuma ideia disponível');
    expect(fixture.nativeElement.querySelector('a[href="/workspace"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-report-idea-card')).toBeNull();
  });

  it('renders the same safe not-found experience for a 404', () => {
    getReport.mockReturnValue(throwError(() => httpError(404, 'REPORT_NOT_FOUND')));
    const fixture = createFixture();

    expect(fixture.nativeElement.textContent).toContain('Relatório não encontrado');
    expect(fixture.nativeElement.textContent).toContain(
      'não foi encontrado ou não está disponível para esta conta',
    );
    expect(fixture.nativeElement.textContent).not.toContain('outro usuário');
  });

  it('rejects an invalid payload without rendering partial report content and permits retry', () => {
    getReport.mockReturnValue(
      throwError(() => new InvalidReportResponseError('Invalid report detail.')),
    );
    const fixture = createFixture();

    expect(fixture.nativeElement.textContent).toContain('dados recebidos');
    expect(fixture.nativeElement.textContent).not.toContain(completeReport.title);

    getReport.mockReturnValue(of(completeReport));
    click(fixture.nativeElement, '.state-card--error button');
    fixture.detectChanges();

    expect(getReport).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain(completeReport.title);
  });

  it('leaves expired-session redirection to the central auth interceptor', () => {
    getReport.mockReturnValue(throwError(() => httpError(401, 'UNAUTHENTICATED')));
    const fixture = createFixture();

    expect(fixture.nativeElement.textContent).toContain('Sessão inválida');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('cancels deletion without calling the service and restores the trigger focus', async () => {
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const trigger = findButton(host, 'Excluir relatório');
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    await Promise.resolve();

    expect(document.activeElement?.textContent?.trim()).toBe('Cancelar');
    clickDialogButton(host, 'Cancelar');
    fixture.detectChanges();
    await Promise.resolve();

    expect(deleteReport).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('shows progress, blocks duplicate confirmation and navigates after a successful deletion', () => {
    const deletion = new Subject<void>();
    deleteReport.mockReturnValue(deletion);
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;
    clickByText(host, 'Excluir relatório');
    fixture.detectChanges();
    clickDialogButton(host, 'Excluir relatório');
    fixture.detectChanges();

    expect(deleteReport).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Excluindo relatório');
    clickDialogButton(host, 'Excluindo…');
    expect(deleteReport).toHaveBeenCalledOnce();

    deletion.next();
    fixture.detectChanges();
    expect(host.textContent).toContain('Relatório excluído com sucesso');
    expect(navigate).toHaveBeenCalledWith(['/relatorios'], {
      queryParams: { exclusao: 'concluida' },
      replaceUrl: true,
    });
  });

  it('treats a concurrent 404 as an already removed report and returns coherently', () => {
    deleteReport.mockReturnValue(throwError(() => httpError(404, 'REPORT_NOT_FOUND')));
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;
    clickByText(host, 'Excluir relatório');
    fixture.detectChanges();
    clickDialogButton(host, 'Excluir relatório');
    fixture.detectChanges();

    expect(host.textContent).toContain('já não estava disponível');
    expect(navigate).toHaveBeenCalledWith(['/relatorios'], {
      queryParams: { exclusao: 'ausente' },
      replaceUrl: true,
    });
  });

  it.each([
    { status: 401, code: 'UNAUTHENTICATED', retry: false, text: 'sessão expirou' },
    { status: 403, code: 'INVALID_CSRF_TOKEN', retry: true, text: 'segurança expirou' },
    { status: 403, code: 'ACCESS_DENIED', retry: false, text: 'não foi autorizada' },
    { status: 0, code: 'NETWORK_ERROR', retry: true, text: 'conectar ao serviço' },
    { status: 500, code: 'INTERNAL_ERROR', retry: true, text: 'foi mantido' },
  ])('keeps the detail after $code and exposes a coherent recovery', ({ status, code, retry, text }) => {
    deleteReport.mockReturnValue(throwError(() => httpError(status, code)));
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;
    clickByText(host, 'Excluir relatório');
    fixture.detectChanges();
    clickDialogButton(host, 'Excluir relatório');
    fixture.detectChanges();

    expect(host.textContent).toContain(completeReport.title);
    expect(host.textContent).toContain(text);
    expect(host.textContent?.includes('Tentar excluir novamente')).toBe(retry);
  });

  it('sorts ideas and sources by position and keeps each source with its idea', () => {
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const ideaCards = Array.from(host.querySelectorAll<HTMLElement>('app-report-idea-card'));

    expect(ideaCards.map((card) => card.querySelector('h3')?.textContent?.trim())).toEqual([
      'Primeira ideia',
      'Segunda ideia',
    ]);
    expect(ideaCards[0]?.textContent).toContain('Fonte da ideia um');
    expect(ideaCards[0]?.textContent).not.toContain('Fonte da ideia dois');
    expect(ideaCards[1]?.textContent).toContain('Fonte da ideia dois');
    expect(ideaCards[1]?.textContent).not.toContain('Fonte geral');

    const generalSources = host.querySelector<HTMLElement>('.general-sources');
    expect(generalSources?.textContent).toContain('Fonte geral');
    expect(generalSources?.textContent).not.toContain('Fonte da ideia um');
  });

  it('renders only HTTP references as safe external links', () => {
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const externalLink = host.querySelector<HTMLAnchorElement>(
      'a[href="https://example.com/idea-one"]',
    );

    expect(externalLink?.target).toBe('_blank');
    expect(externalLink?.rel).toBe('noopener noreferrer');
    expect(host.querySelector<HTMLAnchorElement>('a[href="internal-reference"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('internal-reference');
  });

  it('supports predictable return navigation and exposes native keyboard actions', () => {
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector<HTMLAnchorElement>('a[href="/relatorios"]')?.textContent).toContain(
      'Voltar ao histórico',
    );
    const newReport = host.querySelector<HTMLAnchorElement>('a[href="/workspace"]');
    expect(newReport).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('button:not([type="button"])')).toHaveLength(0);
  });

  it('uses one focusable h1, semantic articles, lists and labelled regions', () => {
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const headings = host.querySelectorAll<HTMLHeadingElement>('h1');
    const reportRegion = host.querySelector<HTMLElement>(
      'section[aria-labelledby="report-page-title"]',
    );

    expect(headings).toHaveLength(1);
    expect(headings[0]?.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(headings[0]);
    expect(reportRegion).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('article.idea-card')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('dl').length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelectorAll('ol').length).toBeGreaterThan(0);
  });

  it('does not call the service for an invalid route identifier', () => {
    routeParams.next(convertToParamMap({ reportId: 'not-a-uuid' }));
    const fixture = createFixture();

    expect(getReport).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('identificador do relatório é inválido');
  });

  function createFixture() {
    const fixture = TestBed.createComponent(ReportDetailPage);
    fixture.detectChanges();
    return fixture;
  }
});

const REPORT_ID = '00000000-0000-4000-8000-000000000001';
const REQUEST_ID = '00000000-0000-4000-8000-000000000002';
const CHANNEL_ID = '00000000-0000-4000-8000-000000000003';
const IDEA_ONE_ID = '00000000-0000-4000-8000-000000000004';
const IDEA_TWO_ID = '00000000-0000-4000-8000-000000000005';

const completeReport: ReportDetailResponse = {
  id: REPORT_ID,
  requestId: REQUEST_ID,
  platformAccountId: CHANNEL_ID,
  platformCode: 'YOUTUBE',
  platformHandle: '@havk',
  channelId: CHANNEL_ID,
  channelName: 'Canal HAVK',
  requestedTopic: 'Angular Signals',
  title: 'Relatório completo de tendências',
  summary: 'Resumo acionável para o canal.',
  dataCollectedAt: '2026-07-22T12:00:00Z',
  generatedAt: '2026-07-22T12:05:00Z',
  createdAt: '2026-07-22T12:05:01Z',
  ideas: [
    idea(IDEA_TWO_ID, 8, 'Segunda ideia', 'dois'),
    idea(IDEA_ONE_ID, 2, 'Primeira ideia', 'um'),
  ],
  sources: [
    source(
      '00000000-0000-4000-8000-000000000008',
      IDEA_TWO_ID,
      8,
      'Fonte da ideia dois',
      'https://example.com/idea-two',
    ),
    source(
      '00000000-0000-4000-8000-000000000007',
      IDEA_ONE_ID,
      3,
      'Fonte da ideia um',
      'https://example.com/idea-one',
    ),
    source('00000000-0000-4000-8000-000000000006', null, 1, 'Fonte geral', 'internal-reference'),
  ],
};

const scriptReport: ReportDetailResponse = {
  ...completeReport,
  ideas: [],
  recommendedFormat: 'SHORT_FORM',
  formatDecision: {
    format: 'SHORT_FORM', reason: 'Os vídeos curtos possuem o melhor sinal de retenção.', confidence: .86,
    metricsUsed: ['retenção'], limitations: [], targetDurationSeconds: 55,
  },
  totalEstimatedDurationSeconds: 55,
  totalEstimatedDurationLabel: '0:55',
  estimatedWordCount: 145,
  speakingRateWordsPerMinute: 165,
  scriptContractVersion: 'report-contract-v3',
  schemaVersion: 'report-contract-v3',
  promptVersion: 'spoken-script-adaptive-v3',
  evidenceSummary: [],
  sections: [
    spokenSection('HOOK', 0, 7, 'Transição natural para o problema.'),
    spokenSection('PROBLEM', 7, 17, 'Transição natural para a solução.'),
    spokenSection('SOLUTION', 17, 45, 'Transição natural para o diferencial.'),
    spokenSection('DIFFERENTIATOR', 45, 55, null),
  ],
};

function spokenSection(key: string, startSecond: number, endSecond: number, transition: string | null) {
  return {
    key, content: `Detalhe editorial ${key}`, purpose: `Propósito ${key}`, reasoning: null, impact: null,
    context: null, consequence: null, relationship: null, expectedOutcome: null, variations: [], keyPoints: [], evidence: [],
    spokenScript: `Texto falado completo da seção ${key}.`, transitionToNextSection: transition,
    modelEstimatedSeconds: endSecond - startSecond, calculatedSpeechSeconds: endSecond - startSecond,
    estimatedSpeechSeconds: endSecond - startSecond, estimatedSpeechLabel: `0:${String(endSecond - startSecond).padStart(2, '0')}`,
    startSecond, endSecond, deliveryNotes: 'Tom natural.', structuredEvidence: [],
  };
}

const reportWithoutOptionals: ReportDetailResponse = {
  ...completeReport,
  requestedTopic: null,
  dataCollectedAt: null,
  ideas: [
    {
      ...idea(IDEA_TWO_ID, 8, 'Segunda ideia', 'dois'),
      relevanceLevel: null,
      competitionLevel: null,
      urgencyLevel: null,
      keywords: [],
      risks: [],
      limitations: [],
    },
  ],
  sources: [
    {
      ...source(
        '00000000-0000-4000-8000-000000000008',
        IDEA_TWO_ID,
        8,
        'Fonte da ideia dois',
        'https://example.com/idea-two',
      ),
      publisher: null,
      publishedAt: null,
    },
  ],
};

function idea(
  id: string,
  position: number,
  provisionalTitle: string,
  suffix: string,
): ReportDetailResponse['ideas'][number] {
  return {
    id,
    position,
    provisionalTitle,
    summary: `Resumo ${suffix}`,
    relatedTrend: `Tendência ${suffix}`,
    compatibilityJustification: `Compatibilidade ${suffix}`,
    hook: `Gancho ${suffix}`,
    problem: `Problema ${suffix}`,
    solution: `Solução ${suffix}`,
    differentiator: `Diferencial ${suffix}`,
    targetAudience: `Público ${suffix}`,
    notes: `Observações ${suffix}`,
    relevanceLevel: 'ALTA',
    competitionLevel: 'MÉDIA',
    urgencyLevel: 'AGORA',
    keywords: [`palavra ${suffix}`],
    risks: [`Risco ${suffix}`],
    limitations: [`Limitação ${suffix}`],
  };
}

function source(
  id: string,
  videoIdeaId: string | null,
  position: number,
  title: string,
  reference: string,
): ReportDetailResponse['sources'][number] {
  return {
    id,
    videoIdeaId,
    position,
    sourceType: 'DOCUMENTATION',
    sourceName: 'Fonte HAVK',
    title,
    reference,
    publisher: 'Publicador HAVK',
    publishedAt: '2026-07-22T11:00:00Z',
    collectedAt: '2026-07-22T12:00:00Z',
  };
}

function httpError(status: number, code: string): HttpErrorResponse {
  const error: ApiError = {
    code,
    message: 'Mensagem que não deve revelar detalhes.',
    status,
    timestamp: '2026-07-22T12:06:00Z',
    path: `/api/reports/${REPORT_ID}`,
    details: [],
  };
  return new HttpErrorResponse({ status, error });
}

function click(element: HTMLElement, selector: string): void {
  const target = element.querySelector<HTMLButtonElement>(selector);
  if (!target) throw new Error(`Button not found: ${selector}`);
  target.click();
}

function clickByText(host: HTMLElement, text: string): void {
  findButton(host, text).click();
}

function clickDialogButton(host: HTMLElement, text: string): void {
  const dialog = host.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error('Dialog not found');
  clickByText(dialog, text);
}

function findButton(host: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}
