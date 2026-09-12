import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PlatformAccountContextStore } from '../../../platform-accounts/data-access/platform-account-context.store';
import { platformAccountContextStub, TEST_PLATFORM_ACCOUNT } from '../../../platform-accounts/testing/platform-account-context.stub';
import { TrendSearch, TrustedSource, YouTubeNicheCollectionRun } from '../../data-access/trend.models';
import { TrendService } from '../../data-access/trend.service';
import { TrendsPage } from './trends-page';

describe('TrendsPage', () => {
  const listSources = vi.fn(); const history = vi.fn(); const search = vi.fn(); const rankCollectedSnapshots = vi.fn();
  const latestCollectedSnapshots = vi.fn(); const latestYouTubeRanking = vi.fn(); const get = vi.fn(); const select = vi.fn();
  beforeEach(() => {
    listSources.mockReset().mockReturnValue(of(sources)); history.mockReset().mockReturnValue(of({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
    search.mockReset().mockReturnValue(of(completed)); rankCollectedSnapshots.mockReset().mockReturnValue(of(nicheRanking)); get.mockReset().mockReturnValue(of(completed)); select.mockReset().mockReturnValue(of({ ...completed, results: [{ ...completed.results[0]!, selected: true }] }));
    latestCollectedSnapshots.mockReset().mockReturnValue(of(realCollection)); latestYouTubeRanking.mockReset().mockReturnValue(of(nicheRanking));
    TestBed.configureTestingModule({ imports: [TrendsPage], providers: [
      { provide: TrendService, useValue: { listSources, history, search, rankCollectedSnapshots, latestCollectedSnapshots, latestYouTubeRanking, get, select } },
      { provide: PlatformAccountContextStore, useFactory: platformAccountContextStub },
    ] });
  });

  it('loads the latest real collection and ranking for the selected account', async () => {
    const fixture = await ready();
    expect(latestCollectedSnapshots).toHaveBeenCalledWith(TEST_PLATFORM_ACCOUNT.id);
    expect(latestYouTubeRanking).toHaveBeenCalledWith(TEST_PLATFORM_ACCOUNT.id);
    expect(fixture.nativeElement.textContent).toContain('Coleta pública mais recente');
    expect(fixture.nativeElement.textContent).toContain('YouTube real');
    expect(fixture.nativeElement.textContent).toContain('20');
    expect(fixture.nativeElement.textContent).toContain('Java 25');
    expect(fixture.nativeElement.textContent).toContain('Dado real');
  });

  it('uses Signal Forms and renders an accessible responsive grid with explicit trust labels', async () => {
    const fixture = await ready(); submitForm(fixture.nativeElement); await settle(fixture);
    expect(search).toHaveBeenCalledWith(TEST_PLATFORM_ACCOUNT.id, expect.objectContaining({ periodDays: 30, sourceTypes: [] }));
    expect(fixture.nativeElement.querySelector('form[novalidate]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.trend-grid')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Fonte oficial');
    expect(fixture.nativeElement.textContent).toContain('Dado real');
    expect(fixture.nativeElement.textContent).toContain('Não foi possível confirmar em fontes adicionais');
    const link = fixture.nativeElement.querySelector('a[target="_blank"]') as HTMLAnchorElement;
    expect(link.rel).toContain('noopener'); expect(link.href).toBe('https://www.bcb.gov.br/noticia/1');
    expect(fixture.nativeElement.querySelector('label[for="trend-term"]')).not.toBeNull();
  });

  it('keeps loading visible and then presents a partial result with unavailable sources', async () => {
    const pending = new Subject<TrendSearch>(); search.mockReturnValue(pending.asObservable()); const fixture = await ready();
    submitForm(fixture.nativeElement); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Consultando fontes confiáveis');
    pending.next({ ...completed, status: 'PARTIAL', failedSources: ['who: timeout'], warningMessage: 'Resultado parcial' }); pending.complete(); await settle(fixture);
    expect(fixture.nativeElement.textContent).toContain('Resultado parcial'); expect(fixture.nativeElement.textContent).toContain('who: timeout');
  });

  it('ranks only already collected YouTube snapshots through the current account', async () => {
    const fixture = await ready();
    (fixture.nativeElement.querySelector('.rank-snapshots') as HTMLButtonElement).click(); await settle(fixture);
    expect(rankCollectedSnapshots).toHaveBeenCalledWith(TEST_PLATFORM_ACCOUNT.id);
    expect(search).not.toHaveBeenCalled(); expect(fixture.nativeElement.textContent).toContain('tendências relevantes');
    expect(fixture.nativeElement.textContent).toContain('72% · confiança Média');
    expect(fixture.nativeElement.textContent).toContain('3 vídeos · 2 canais');
    expect(fixture.nativeElement.textContent).toContain('Penalização de 10%');
  });

  it.each([
    ['INSUFFICIENT_COVERAGE', 'Cobertura insuficiente'], ['EMPTY', 'Pesquisa sem resultados confiáveis'],
  ] as const)('renders the %s state clearly', async (status, expected) => {
    search.mockReturnValue(of({ ...completed, status, results: [], warningMessage: status === 'INSUFFICIENT_COVERAGE' ? 'Cobertura insuficiente de fontes confiáveis para este nicho.' : null }));
    const fixture = await ready(); submitForm(fixture.nativeElement); await settle(fixture); expect(fixture.nativeElement.textContent).toContain(expected);
  });

  it('renders no-account without mixing contexts', async () => {
    TestBed.resetTestingModule(); TestBed.configureTestingModule({ imports: [TrendsPage], providers: [
      { provide: TrendService, useValue: { listSources, history, search, rankCollectedSnapshots, latestCollectedSnapshots, latestYouTubeRanking, get, select } },
      { provide: PlatformAccountContextStore, useFactory: () => platformAccountContextStub(null) },
    ] }); const noAccount = TestBed.createComponent(TrendsPage); noAccount.detectChanges(); await settle(noAccount);
    expect(noAccount.nativeElement.textContent).toContain('Nenhuma conta selecionada'); expect(search).not.toHaveBeenCalled();
  });

  it('renders an accessible error state', async () => {
    listSources.mockReturnValue(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(TrendsPage); fixture.detectChanges(); await settle(fixture);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Pesquisa indisponível');
  });

  it('selects a trend and persists only result ids for the current account and search', async () => {
    const fixture = await ready(); submitForm(fixture.nativeElement); await settle(fixture);
    (fixture.nativeElement.querySelector('.actions button') as HTMLButtonElement).click(); fixture.detectChanges();
    const save = [...fixture.nativeElement.querySelectorAll('.results-heading button')] as HTMLButtonElement[]; save[0]?.click(); await settle(fixture);
    expect(select).toHaveBeenCalledWith(TEST_PLATFORM_ACCOUNT.id, completed.id, [completed.results[0]!.id]);
  });

  async function ready() { const fixture = TestBed.createComponent(TrendsPage); fixture.detectChanges(); await settle(fixture); return fixture; }
});

function submitForm(root: HTMLElement): void { root.querySelector('form')?.dispatchEvent(new Event('submit')); }
async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }): Promise<void> {
  await fixture.whenStable(); await Promise.resolve(); await Promise.resolve(); await fixture.whenStable(); fixture.detectChanges();
}

const sources: readonly TrustedSource[] = [{ code: 'bcb', name: 'Banco Central', domain: 'bcb.gov.br', niches: ['finanças'], regions: ['BR'], languages: ['pt-BR'], type: 'REGULATORY_AUTHORITY', reliability: 'AUTHORITATIVE', collectionMethod: 'RSS', active: true, updateInterval: 'PT1H', usageNotes: null }];
const completed: TrendSearch = {
  id: '10000000-0000-4000-8000-000000000001', platformAccountId: TEST_PLATFORM_ACCOUNT.id, term: 'juros', periodStart: '2026-06-29T12:00:00Z', periodEnd: '2026-07-29T12:00:00Z', language: 'pt-BR', region: 'BR', sourceFilters: [], status: 'COMPLETED', contextSummary: 'nicho finanças', consultedSources: ['bcb'], failedSources: [], warningMessage: null, collectedAt: '2026-07-29T12:00:00Z', results: [{
    id: '20000000-0000-4000-8000-000000000001', title: 'Banco Central publica decisão sobre juros', factualSummary: 'A fonte publicou a decisão factual.', originalUrl: 'https://www.bcb.gov.br/noticia/1', sourceName: 'Banco Central', sourceDomain: 'bcb.gov.br', sourceType: 'REGULATORY_AUTHORITY', sourceReliability: 'AUTHORITATIVE', authorOrInstitution: 'Banco Central', publishedAt: '2026-07-28T12:00:00Z', collectedAt: '2026-07-29T12:00:00Z', language: 'pt-BR', region: 'BR', keywords: ['juros'], relevance: 88.5, rankingConfidence: .8, relevanceReason: 'relacionado ao nicho; fonte authoritative.', evidence: ['URL original preservada'], rankingFactors: { niche: 25 }, freshnessStatus: 'CURRENT', realData: true, simulated: false, additionallyConfirmed: false, conflictingSources: false, selected: false, selectedAt: null, recommendation: null, unavailableData: [],
  }],
};
const nicheRanking: TrendSearch = { ...completed, term: 'Oportunidades editoriais do YouTube', results: [{
  ...completed.results[0]!, title: 'Java 25', sourceName: 'YouTube · sinais públicos persistidos', sourceDomain: 'youtube.com',
  sourceType: 'COMMUNITY', sourceReliability: 'SUPPLEMENTARY', relevance: .72, rankingConfidence: .65,
  factualSummary: '3 vídeos públicos de 2 canais. O sinal não é previsão de viralidade.',
  relevanceReason: 'Alta relevância para o perfil; adoção por múltiplos canais.',
  rankingFactors: { profileRelevance: 1, publicVelocity: .8, publicEngagement: .6, recency: .9,
    adoptionBreadth: .5, repetitionPenalty: .1, distinctVideoCount: 3, distinctChannelCount: 2 },
  evidence: ['Evidência: 3 vídeos distintos de 2 canais distintos.'], additionallyConfirmed: true,
}] };
const realCollection: YouTubeNicheCollectionRun = {
  id: '30000000-0000-4000-8000-000000000001', platformAccountId: TEST_PLATFORM_ACCOUNT.id,
  provider: 'YOUTUBE', status: 'COMPLETED', failureCode: null, failureMessage: null,
  searchQueries: ['Java'], lookbackFrom: '2026-07-29T12:00:00Z', observedAt: '2026-08-05T12:00:00Z',
  completedAt: '2026-08-05T12:00:01Z', searchCalls: 2, videoDetailBatches: 1, channelDetailBatches: 1,
  quotaUnits: 202, searchResults: 20, uniqueVideoIds: 20, videosPersisted: 20, channelsPersisted: 18,
  ignoredPrivate: 0, ignoredUnavailable: 0, ignoredMissingData: 0,
};
