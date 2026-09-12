import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { ChannelResponse } from '../../../channels/data-access/channel.models';
import { ChannelService } from '../../../channels/data-access/channel.service';
import {
  CreateReportRequest,
  ReportPollingEvent,
  ReportRequestAcceptedResponse,
  ReportRequestResponse,
} from '../../data-access/report-generation.models';
import { ReportGenerationService } from '../../data-access/report-generation.service';
import { ReportGenerationPage } from './report-generation-page';
import { PlatformAccountContextStore } from '../../../platform-accounts/data-access/platform-account-context.store';
import { platformAccountContextStub } from '../../../platform-accounts/testing/platform-account-context.stub';
import { TrendService } from '../../../trends/data-access/trend.service';

describe('ReportGenerationPage', () => {
  const getChannel = vi.fn<() => Promise<ChannelResponse>>();
  const createRequest = vi.fn<
    (request: CreateReportRequest) => Observable<ReportRequestAcceptedResponse>
  >();
  const getRequest = vi.fn<(requestId: string) => Observable<ReportRequestResponse>>();
  const watchRequest = vi.fn<(requestId: string) => Observable<ReportPollingEvent>>();
  let updates: Subject<ReportPollingEvent>;

  beforeEach(() => {
    updates = new Subject<ReportPollingEvent>();
    getChannel.mockReset();
    createRequest.mockReset();
    getRequest.mockReset();
    watchRequest.mockReset();
    getChannel.mockResolvedValue(channel);
    createRequest.mockReturnValue(of({ requestId: 'request-1', status: 'QUEUED' }));
    getRequest.mockReturnValue(of(reportRequest('GENERATING_REPORT')));
    watchRequest.mockReturnValue(updates);

    TestBed.configureTestingModule({
      imports: [ReportGenerationPage],
      providers: [
        provideRouter([]),
        { provide: ChannelService, useValue: { getChannel } },
        { provide: PlatformAccountContextStore, useFactory: platformAccountContextStub },
        { provide: TrendService, useValue: { selected: () => of([]) } },
        {
          provide: ReportGenerationService,
          useValue: { createRequest, getRequest, watchRequest },
        },
      ],
    });
  });

  it('loads the single authenticated channel and starts with a typed form', async () => {
    const fixture = createFixture();
    expect(fixture.nativeElement.textContent).toContain('Carregando seu canal');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Canal HAVK');
    expect(fixture.nativeElement.textContent).toContain('Gancho · Problema · Solução · Diferencial');
  });

  it('resumes an active dashboard request through the existing polling screen', async () => {
    const requestId = '00000000-0000-4000-8000-000000000031';
    getRequest.mockReturnValue(of({ ...reportRequest('GENERATING_REPORT'), requestId }));
    TestBed.inject(Router).resetConfig([{ path: 'relatorios/novo', component: ReportGenerationPage }]);
    const harness = await RouterTestingHarness.create(`/relatorios/novo?solicitacao=${requestId}`);
    await TestBed.inject(ApplicationRef).whenStable();
    harness.detectChanges();

    expect(getRequest).toHaveBeenCalledWith(requestId);
    expect(watchRequest).toHaveBeenCalledWith(requestId);
    expect(harness.routeNativeElement?.textContent).toContain('Preparando sua ideia e roteiro.');
  });

  it('requires and limits the topic only in TOPIC_GUIDED', async () => {
    const fixture = await readyFixture();
    (fixture.nativeElement.querySelector('input[value="TOPIC_GUIDED"]') as HTMLInputElement | null)?.click();
    fixture.detectChanges();
    fill(fixture.nativeElement, '#report-topic', 'x'.repeat(201));
    submitForm(fixture.nativeElement);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createRequest).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Use no máximo 200 caracteres.');
  });

  it('normalizes and submits the request, then follows processing updates', async () => {
    const fixture = await readyFixture();
    fill(fixture.nativeElement, '#report-topic', '  Angular Signals  ');
    fill(fixture.nativeElement, '#report-objective', '  Ensinar Signals com um exemplo  ');
    fill(fixture.nativeElement, '#report-instructions', '  Priorize exemplos práticos.  ');
    submitForm(fixture.nativeElement);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createRequest).toHaveBeenCalledWith({
      platformAccountId: '00000000-0000-4000-8000-000000000003',
      conversationId: null,
      generationStrategy: 'SURPRISE_ME',
      topic: null,
      objective: 'Ensinar Signals com um exemplo',
      instructions: 'Priorize exemplos práticos.',
      clientRequestId: expect.any(String),
    });
    expect(watchRequest).toHaveBeenCalledWith('request-1');
    expect(fixture.nativeElement.textContent).toContain('Pedido recebido.');
    expect(fixture.nativeElement.textContent).toContain('Criando relatório');

    updates.next({
      kind: 'update',
      request: { ...reportRequest('QUEUED'), processingStep: 'GENERATING_REPORT' },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Preparando sua ideia e roteiro.');
    expect(fixture.nativeElement.querySelector('[data-state="active"]')?.textContent).toContain(
      'Preparando ideia e roteiro',
    );
  });

  it('submits TOPIC_GUIDED with a normalized required topic', async () => {
    const fixture = await readyFixture();
    (fixture.nativeElement.querySelector('input[value="TOPIC_GUIDED"]') as HTMLInputElement | null)?.click();
    fixture.detectChanges();
    fill(fixture.nativeElement, '#report-topic', '  APIs REST com Spring Boot  ');
    submitForm(fixture.nativeElement);
    await fixture.whenStable();

    expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
      generationStrategy: 'TOPIC_GUIDED',
      topic: 'APIs REST com Spring Boot',
      clientRequestId: expect.any(String),
    }));
  });

  it('renders every backend processing stage and completes all previous steps', async () => {
    const fixture = await submittedFixture();
    const stages = [
      ['QUEUED', 'Pedido recebido.'],
      ['DISCOVERING_CONTENT', 'Buscando conteúdos relevantes para sua pesquisa.'],
      ['SELECTING_CONTENT', 'Selecionando os melhores conteúdos para análise.'],
      ['ANALYZING_CONTENT', 'Estamos avaliando as melhores oportunidades.'],
      ['FINDING_OPPORTUNITIES', 'Comparando padrões, recorrência e desempenho.'],
      ['BUILDING_STRATEGY', 'Transformando as oportunidades em uma estratégia.'],
      ['GENERATING_REPORT', 'Preparando sua ideia e roteiro.'],
    ] as const;

    for (const [status, message] of stages) {
      updates.next({ kind: 'update', request: reportRequest(status) });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(message);
      const stepNodes = fixture.nativeElement.querySelectorAll(
        '.progress-list li',
      ) as NodeListOf<HTMLElement>;
      const steps = Array.from(stepNodes);
      const activeIndex = stages.findIndex(([candidate]) => candidate === status);
      expect(steps[activeIndex]?.getAttribute('data-state')).toBe('active');
      expect(steps.slice(0, activeIndex).every(
        (step) => step.getAttribute('data-state') === 'completed',
      )).toBe(true);
    }

    expect(fixture.nativeElement.querySelector('fieldset')?.disabled).toBe(true);
    expect(createRequest).toHaveBeenCalledTimes(1);
  });

  it('uses status as fallback and gives a normalized processingStep priority', async () => {
    const fixture = await submittedFixture();

    updates.next({
      kind: 'update',
      request: { requestId: 'request-1', status: 'ANALYZING_CONTENT' },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Estamos avaliando as melhores oportunidades.');

    updates.next({
      kind: 'update',
      request: {
        requestId: 'request-1',
        status: 'QUEUED',
        processingStep: '  generating_report  ',
        reportId: null,
      },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Preparando sua ideia e roteiro.');
    expect(fixture.nativeElement.querySelector('[aria-current="step"]')?.textContent).toContain(
      'Preparando ideia e roteiro',
    );
  });

  it('blocks duplicate form submissions before the POST completes', async () => {
    const accepted = new Subject<ReportRequestAcceptedResponse>();
    createRequest.mockReturnValue(accepted);
    const fixture = await readyFixture();
    fill(fixture.nativeElement, '#report-topic', 'Angular Signals');
    fill(fixture.nativeElement, '#report-objective', 'Ensinar aplicações práticas');

    submitForm(fixture.nativeElement);
    submitForm(fixture.nativeElement);
    fixture.detectChanges();

    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Enviando solicitação');
    expect(fixture.nativeElement.querySelector('fieldset')?.disabled).toBe(true);
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute('aria-busy')).toBe('true');

    accepted.next({ requestId: 'request-1', status: 'QUEUED' });
    accepted.complete();
    await fixture.whenStable();
  });

  it('redirects automatically to the real report detail route when processing completes', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = await submittedFixture();
    updates.next({ kind: 'update', request: reportRequest('COMPLETED', 'report-1') });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith(['/relatorios', 'report-1']);
    expect(updates.observed).toBe(false);
  });

  it('shows a sanitized terminal failure without loading a report', async () => {
    const fixture = await submittedFixture();
    updates.next({
      kind: 'update',
      request: {
        ...reportRequest('FAILED'),
        failureCode: 'PROVIDER_UNAVAILABLE',
        failureMessage: 'Não foi possível concluir agora.',
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Não foi possível concluir agora.');
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    expect(button?.disabled).toBe(false);
    expect(button?.hasAttribute('aria-busy')).toBe(false);
  });

  it('ends loading with the safe cancellation message', async () => {
    const fixture = await submittedFixture();
    updates.next({
      kind: 'update',
      request: {
        ...reportRequest('CANCELLED'),
        failureMessage: 'A solicitação foi cancelada pelo processamento.',
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Solicitação cancelada.');
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    expect(button?.disabled).toBe(false);
  });

  it('keeps the last stage, loading and single POST through a temporary error, then clears it', async () => {
    const fixture = await submittedFixture();
    updates.next({ kind: 'update', request: reportRequest('GENERATING_REPORT') });
    updates.next({ kind: 'temporary-error', error: new HttpErrorResponse({ status: 503 }) });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Preparando sua ideia e roteiro.');
    expect(fixture.nativeElement.textContent).toContain(
      'Não foi possível atualizar o status agora. Tentando novamente',
    );
    expect(fixture.nativeElement.querySelector('.tracking-resume')).toBeNull();
    expect(fixture.nativeElement.querySelector('fieldset')?.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.loading-spinner')).not.toBeNull();
    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(updates.observed).toBe(true);

    updates.next({ kind: 'update', request: reportRequest('ANALYZING_CONTENT') });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Não foi possível atualizar o status agora',
    );
    expect(fixture.nativeElement.textContent).toContain('Estamos avaliando as melhores oportunidades.');

    for (let index = 0; index < 4; index += 1) {
      updates.next({ kind: 'temporary-error', error: new HttpErrorResponse({ status: 503 }) });
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tracking-resume')).toBeNull();

    fixture.destroy();
    expect(updates.observed).toBe(false);
  });

  it('shows resume only after polling is paused and resumes the same GET sequence', async () => {
    const fixture = await submittedFixture();

    for (let index = 0; index < 5; index += 1) {
      updates.next({ kind: 'temporary-error', error: new HttpErrorResponse({ status: 503 }) });
      fixture.detectChanges();
      if (index < 4) {
        expect(fixture.nativeElement.querySelector('.tracking-resume')).toBeNull();
      }
    }

    const resume = fixture.nativeElement.querySelector(
      '.tracking-resume',
    ) as HTMLButtonElement | null;
    expect(resume).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('acompanhamento foi pausado');
    expect(updates.observed).toBe(false);
    expect(fixture.nativeElement.querySelector('fieldset')?.disabled).toBe(true);

    resume?.click();
    fixture.detectChanges();
    expect(watchRequest).toHaveBeenCalledTimes(2);
    expect(watchRequest).toHaveBeenNthCalledWith(1, 'request-1');
    expect(watchRequest).toHaveBeenNthCalledWith(2, 'request-1');
    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(updates.observed).toBe(true);
    expect(fixture.nativeElement.querySelector('.tracking-resume')).toBeNull();

    resume?.click();
    expect(watchRequest).toHaveBeenCalledTimes(2);
  });

  it('clears a previous warning, stops polling and navigates only once on completion', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = await submittedFixture();
    updates.next({ kind: 'temporary-error', error: new HttpErrorResponse({ status: 503 }) });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.polling-warning')).not.toBeNull();

    updates.next({ kind: 'update', request: reportRequest('COMPLETED', 'report-1') });
    updates.next({ kind: 'update', request: reportRequest('COMPLETED', 'report-1') });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.polling-warning')).toBeNull();
    expect(fixture.nativeElement.querySelector('.polling-error')).toBeNull();
    expect(updates.observed).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/relatorios', 'report-1']);
  });

  it('announces the current stage and identifies the active step accessibly', async () => {
    const fixture = await submittedFixture();
    updates.next({ kind: 'update', request: reportRequest('BUILDING_STRATEGY') });
    fixture.detectChanges();

    const liveMessage = fixture.nativeElement.querySelector(
      '.progress-message',
    ) as HTMLElement | null;
    const activeStep = fixture.nativeElement.querySelector(
      '[aria-current="step"]',
    ) as HTMLElement | null;
    expect(liveMessage?.getAttribute('aria-live')).toBe('polite');
    expect(liveMessage?.textContent).toContain('Transformando as oportunidades em uma estratégia.');
    expect(activeStep?.textContent).toContain('Montando a estratégia');
    expect(activeStep?.textContent).toContain('em andamento');
  });

  it('renders an empty prerequisite state when no platform account exists', async () => {
    TestBed.overrideProvider(PlatformAccountContextStore, { useValue: platformAccountContextStub(null) });
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cadastre uma conta de plataforma');
    expect(fixture.nativeElement.querySelector('a[href="/contas-de-plataforma"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('rejects a completed response without a report identifier', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = await submittedFixture();
    updates.next({ kind: 'update', request: reportRequest('COMPLETED') });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('relatório retornado é inválido');
    expect(navigate).not.toHaveBeenCalled();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(ReportGenerationPage);
    fixture.detectChanges();
    return fixture;
  }

  async function readyFixture() {
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  async function submittedFixture() {
    const fixture = await readyFixture();
    fill(fixture.nativeElement, '#report-topic', 'Angular Signals');
    fill(fixture.nativeElement, '#report-objective', 'Ensinar aplicações práticas');
    submitForm(fixture.nativeElement);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
});

const channel: ChannelResponse = {
  id: 'channel-1',
  platform: 'YOUTUBE',
  name: 'Canal HAVK',
  description: 'Conteúdo para criadores.',
  url: 'https://youtube.com/@havk',
  externalIdentifier: null,
  approximateSize: 1200,
  mainCategory: 'Educação',
  language: 'Português',
  createdAt: '2026-07-22T12:00:00Z',
  updatedAt: '2026-07-22T12:00:00Z',
};

function reportRequest(
  status: ReportRequestResponse['status'],
  reportId: string | null = null,
): ReportRequestResponse {
  return {
    requestId: 'request-1',
    platformAccountId: 'account-1',
    channelId: 'channel-1',
    topic: null,
    objective: 'Produzir conteúdo útil',
    instructions: null,
    ideaCount: 5,
    methodology: 'HOOK_PROBLEM_SOLUTION_DIFFERENTIATOR',
    selectedTrendIds: [],
    reportVersion: 1,
    regeneratedFromReportId: null,
    status,
    processingStep: status,
    attemptCount: 1,
    nextAttemptAt: null,
    failureCategory: null,
    failureCode: null,
    failureMessage: null,
    reportId,
    createdAt: '2026-07-22T12:00:00Z',
    updatedAt: '2026-07-22T12:00:00Z',
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
  };
}
function fill(element: HTMLElement, selector: string, value: string): void {
  const control = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!control) throw new Error(`Control not found: ${selector}`);
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
}

function inputValue(element: HTMLElement, selector: string): string {
  const control = element.querySelector<HTMLInputElement>(selector);
  if (!control) throw new Error(`Control not found: ${selector}`);
  return control.value;
}

function submitForm(element: HTMLElement): void {
  element.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
