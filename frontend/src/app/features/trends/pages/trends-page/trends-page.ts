import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField, maxLength, required, submit, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../../core/http/api-error-message';
import { PlatformAccountSelector } from '../../../platform-accounts/components/platform-account-selector/platform-account-selector';
import { PlatformAccountContextStore } from '../../../platform-accounts/data-access/platform-account-context.store';
import { EMPTY_TREND_FORM, TrendResult, TrendSearch, TrendSearchFormModel, TrustedSource, toTrendSearchRequest, YouTubeNicheCollectionRun } from '../../data-access/trend.models';
import { TrendService } from '../../data-access/trend.service';

type ViewStatus = 'initial' | 'loading' | 'success' | 'empty' | 'partial' | 'error' | 'insufficient-coverage' | 'no-account';

@Component({ selector: 'app-trends-page', standalone: true, imports: [FormField, PlatformAccountSelector],
  templateUrl: './trends-page.html', styleUrls: ['./trends-page.scss', './trends-page.collection.scss'] })
export class TrendsPage implements OnInit {
  private readonly service = inject(TrendService); protected readonly accounts = inject(PlatformAccountContextStore);
  protected readonly status = signal<ViewStatus>('initial'); protected readonly message = signal<string | null>(null);
  protected readonly current = signal<TrendSearch | null>(null); protected readonly history = signal<readonly TrendSearch[]>([]);
  protected readonly latestCollection = signal<YouTubeNicheCollectionRun | null>(null);
  protected readonly sources = signal<readonly TrustedSource[]>([]); protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly savingSelection = signal(false); protected readonly model = signal<TrendSearchFormModel>({ ...EMPTY_TREND_FORM });
  protected readonly loadingMessage = signal('Consultando fontes confiáveis…');
  protected readonly searchForm = form(this.model, (fields) => {
    required(fields.periodDays, { message: 'Selecione o período.' }); maxLength(fields.term, 200);
    maxLength(fields.region, 100); maxLength(fields.language, 50);
    validate(fields.periodDays, ({ value }) => Number(value()) >= 1 && Number(value()) <= 3650 ? null
      : { kind: 'period', message: 'Escolha um período entre 1 e 3650 dias.' });
  });
  protected readonly selectedCount = computed(() => this.selectedIds().size);

  async ngOnInit(): Promise<void> { await this.accounts.load(); await this.loadContext(); }
  protected async accountChanged(): Promise<void> { this.current.set(null); this.selectedIds.set(new Set()); await this.loadContext(); }
  protected async search(event: Event): Promise<void> {
    event.preventDefault(); const accountId = this.accounts.selectedId(); if (!accountId) { this.status.set('no-account'); return; }
    await submit(this.searchForm, { onInvalid: () => this.message.set('Revise os filtros informados.'), action: async () => {
      this.status.set('loading'); this.loadingMessage.set('Consultando fontes confiáveis…'); this.message.set(null);
      try { const result = await firstValueFrom(this.service.search(accountId, toTrendSearchRequest(this.model())));
        this.applySearch(result); await this.loadHistory(accountId); }
      catch (error: unknown) { this.status.set('error'); this.message.set(apiErrorMessage(error, 'Não foi possível pesquisar tendências.')); }
      return undefined;
    }});
  }
  protected async rankCollectedSnapshots(): Promise<void> {
    const accountId = this.accounts.selectedId(); if (!accountId) { this.status.set('no-account'); return; }
    this.status.set('loading'); this.loadingMessage.set('Classificando snapshots públicos persistidos…'); this.message.set(null);
    try { this.applySearch(await firstValueFrom(this.service.rankCollectedSnapshots(accountId))); await this.loadHistory(accountId); }
    catch (error: unknown) { this.status.set('error'); this.message.set(apiErrorMessage(error,
      'Não foi possível classificar os snapshots públicos desta conta.')); }
  }
  protected async openHistory(item: TrendSearch): Promise<void> {
    const accountId = this.accounts.selectedId(); if (!accountId) return; this.status.set('loading'); this.loadingMessage.set('Carregando ranking persistido…');
    try { this.applySearch(await firstValueFrom(this.service.get(accountId, item.id))); }
    catch (error: unknown) { this.status.set('error'); this.message.set(apiErrorMessage(error, 'Não foi possível abrir a pesquisa.')); }
  }
  protected toggle(result: TrendResult): void { const next = new Set(this.selectedIds()); next.has(result.id) ? next.delete(result.id) : next.add(result.id); this.selectedIds.set(next); }
  protected async saveSelection(): Promise<void> {
    const accountId = this.accounts.selectedId(), search = this.current(); if (!accountId || !search || this.savingSelection()) return;
    this.savingSelection.set(true);
    try { this.applySearch(await firstValueFrom(this.service.select(accountId, search.id, [...this.selectedIds()]))); this.message.set('Seleção de tendências salva.'); }
    catch (error: unknown) { this.message.set(apiErrorMessage(error, 'Não foi possível salvar a seleção.')); }
    finally { this.savingSelection.set(false); }
  }
  protected sourceLabel(result: TrendResult): string { switch (result.sourceReliability) { case 'AUTHORITATIVE': return 'Fonte oficial'; case 'PRIMARY': return 'Fonte primária'; case 'REPUTABLE_SECONDARY': return 'Fonte especializada'; default: return 'Fonte complementar'; } }
  protected publishedLabel(value: string | null): string { if (!value) return 'Data de publicação indisponível'; const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)); return days === 0 ? 'Publicado hoje' : `Publicado há ${days} ${days === 1 ? 'dia' : 'dias'}`; }
  protected collectedLabel(value: string): string { return `Coletado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))}`; }
  protected historyLabel(item: TrendSearch): string { return item.term || 'Pesquisa pelo contexto da conta'; }
  protected confidencePercent(value: number): number { return Math.round(value * 100); }
  protected isNicheRanking(result: TrendResult): boolean { return result.sourceDomain === 'youtube.com'; }
  protected relevanceLabel(result: TrendResult): string {
    return this.isNicheRanking(result) ? `${Math.round(result.relevance * 100)}%` : `${result.relevance.toFixed(1)}/100`;
  }
  protected confidenceLabel(result: TrendResult): string {
    if (!this.isNicheRanking(result)) return `${this.confidencePercent(result.rankingConfidence)}%`;
    if (result.rankingConfidence >= .8) return 'Alta'; if (result.rankingConfidence >= .5) return 'Média';
    if (result.rankingConfidence > 0) return 'Baixa'; return 'Insuficiente';
  }
  protected factorPercent(result: TrendResult, name: string): number {
    return Math.round((result.rankingFactors[name] ?? 0) * 100);
  }
  protected factorCount(result: TrendResult, name: string): number {
    return Math.round(result.rankingFactors[name] ?? 0);
  }
  protected collectionStatusLabel(collection: YouTubeNicheCollectionRun): string {
    if (collection.failureCode === 'CACHE_FRESH') return 'Cache válido';
    switch (collection.status) {
      case 'COMPLETED': return 'Concluída'; case 'PARTIAL': return 'Parcial'; case 'FAILED': return 'Falhou';
      case 'SKIPPED': return 'Não executada'; case 'PENDING': return 'Pendente'; default: return 'Em andamento';
    }
  }

  private async loadContext(): Promise<void> {
    if (!this.accounts.selectedId()) { this.status.set('no-account'); this.history.set([]); this.latestCollection.set(null); return; }
    this.status.set('loading'); this.loadingMessage.set('Carregando coleta e ranking persistidos…');
    const accountId = this.accounts.selectedId(); if (!accountId) return;
    try {
      const [sources, collection, ranking] = await Promise.all([
        firstValueFrom(this.service.listSources()), firstValueFrom(this.service.latestCollectedSnapshots(accountId)),
        this.loadLatestRanking(accountId), this.loadHistory(accountId),
      ]);
      this.sources.set(sources); this.latestCollection.set(collection);
      if (ranking) this.applySearch(ranking); else this.status.set('initial');
    }
    catch (error: unknown) { this.status.set('error'); this.message.set(apiErrorMessage(error, 'Não foi possível carregar a pesquisa de tendências.')); }
  }
  private async loadLatestRanking(accountId: string): Promise<TrendSearch | null> {
    try { return await firstValueFrom(this.service.latestYouTubeRanking(accountId)); }
    catch (error: unknown) {
      if (this.isMissingRanking(error)) return null;
      throw error;
    }
  }
  private isMissingRanking(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { status?: unknown; error?: unknown };
    if (candidate.status !== 409 || !candidate.error || typeof candidate.error !== 'object') return false;
    return (candidate.error as { code?: unknown }).code === 'YOUTUBE_NICHE_RANKING_NOT_FOUND';
  }
  private async loadHistory(accountId: string): Promise<void> { const page = await firstValueFrom(this.service.history(accountId)); this.history.set(page.content); }
  private applySearch(search: TrendSearch): void {
    this.current.set(search); this.selectedIds.set(new Set(search.results.filter((result) => result.selected).map((result) => result.id)));
    this.message.set(search.warningMessage);
    this.status.set(search.status === 'INSUFFICIENT_COVERAGE' ? 'insufficient-coverage' : search.status === 'PARTIAL' ? 'partial'
      : search.status === 'EMPTY' || search.results.length === 0 ? 'empty' : 'success');
  }
}
