export type TrendSearchStatus = 'COMPLETED' | 'PARTIAL' | 'EMPTY' | 'INSUFFICIENT_COVERAGE';
export type SourceReliability = 'AUTHORITATIVE' | 'PRIMARY' | 'REPUTABLE_SECONDARY' | 'SUPPLEMENTARY';

export interface TrustedSource {
  readonly code: string; readonly name: string; readonly domain: string; readonly niches: readonly string[];
  readonly regions: readonly string[]; readonly languages: readonly string[]; readonly type: string;
  readonly reliability: SourceReliability; readonly collectionMethod: string; readonly active: boolean;
  readonly updateInterval: string; readonly usageNotes: string | null;
}
export interface TrendResult {
  readonly id: string; readonly title: string; readonly factualSummary: string; readonly originalUrl: string;
  readonly sourceName: string; readonly sourceDomain: string; readonly sourceType: string;
  readonly sourceReliability: SourceReliability; readonly authorOrInstitution: string | null;
  readonly publishedAt: string | null; readonly collectedAt: string; readonly language: string | null;
  readonly region: string | null; readonly keywords: readonly string[]; readonly relevance: number;
  readonly rankingConfidence: number; readonly relevanceReason: string; readonly evidence: readonly string[];
  readonly rankingFactors: Readonly<Record<string, number>>; readonly freshnessStatus: string;
  readonly realData: boolean; readonly simulated: boolean; readonly additionallyConfirmed: boolean;
  readonly conflictingSources: boolean; readonly selected: boolean; readonly selectedAt: string | null;
  readonly recommendation: null; readonly unavailableData: readonly string[];
}
export interface TrendSearch {
  readonly id: string; readonly platformAccountId: string; readonly term: string | null;
  readonly periodStart: string; readonly periodEnd: string; readonly language: string | null;
  readonly region: string | null; readonly sourceFilters: readonly string[]; readonly status: TrendSearchStatus;
  readonly contextSummary: string; readonly consultedSources: readonly string[]; readonly failedSources: readonly string[];
  readonly warningMessage: string | null; readonly collectedAt: string; readonly results: readonly TrendResult[];
}
export interface TrendSearchPage { readonly content: readonly TrendSearch[]; readonly page: number; readonly size: number; readonly totalElements: number; readonly totalPages: number; }
export interface YouTubeNicheCollectionRun {
  readonly id: string; readonly platformAccountId: string; readonly provider: 'FAKE' | 'YOUTUBE';
  readonly status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
  readonly failureCode: string | null; readonly failureMessage: string | null;
  readonly searchQueries: readonly string[]; readonly lookbackFrom: string | null;
  readonly observedAt: string; readonly completedAt: string | null; readonly searchCalls: number;
  readonly videoDetailBatches: number; readonly channelDetailBatches: number; readonly quotaUnits: number;
  readonly searchResults: number; readonly uniqueVideoIds: number; readonly videosPersisted: number;
  readonly channelsPersisted: number; readonly ignoredPrivate: number; readonly ignoredUnavailable: number;
  readonly ignoredMissingData: number;
}
export interface TrendSearchRequest { readonly term: string | null; readonly periodDays: number; readonly region: string | null; readonly language: string | null; readonly sourceTypes: readonly string[]; }
export interface TrendSearchFormModel { term: string; periodDays: string; region: string; language: string; sourceType: string; }
export const EMPTY_TREND_FORM: TrendSearchFormModel = { term: '', periodDays: '30', region: '', language: '', sourceType: '' };
export function toTrendSearchRequest(model: TrendSearchFormModel): TrendSearchRequest {
  return { term: optional(model.term), periodDays: Number(model.periodDays), region: optional(model.region),
    language: optional(model.language), sourceTypes: model.sourceType ? [model.sourceType] : [] };
}
function optional(value: string): string | null { return value.trim() || null; }
