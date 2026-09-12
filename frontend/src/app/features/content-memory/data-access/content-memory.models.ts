export type ContentType = 'VIDEO' | 'SHORT_VIDEO' | 'LIVE' | 'IMAGE_POST' | 'CAROUSEL'
  | 'TEXT_POST' | 'ARTICLE' | 'THREAD' | 'OTHER';
export type ContentAnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'NOT_APPLICABLE';

export interface ContentMetrics {
  readonly measuredAt: string; readonly source: string; readonly simulated: boolean;
  readonly views: number | null; readonly likes: number | null; readonly comments: number | null;
  readonly shares: number | null; readonly watchedMinutes: number | null;
  readonly averageViewDurationSeconds: number | null; readonly retentionRate: number | null;
  readonly subscribersGained: number | null;
}
export interface ContentAnalysis {
  readonly id: string; readonly provider: string; readonly model: string; readonly summary: string;
  readonly topics: readonly string[]; readonly angles: readonly string[]; readonly hookPatterns: readonly string[];
  readonly simulated: boolean; readonly analyzedAt: string;
}
export interface ContentItem {
  readonly id: string; readonly platformAccountId: string; readonly externalIdentifier: string | null;
  readonly contentType: ContentType; readonly title: string; readonly description: string | null;
  readonly publicUrl: string | null; readonly language: string | null; readonly publishedAt: string | null;
  readonly durationSeconds: number | null; readonly dataOrigin: string; readonly transcriptStatus: string;
  readonly analysisStatus: ContentAnalysisStatus; readonly contentHash: string; readonly updatedAt: string;
  readonly latestMetrics: ContentMetrics | null; readonly latestAnalysis: ContentAnalysis | null;
}
export interface ContentMemoryPage {
  readonly items: readonly ContentItem[]; readonly page: number; readonly size: number;
  readonly totalElements: number; readonly totalPages: number;
}
export interface TranscriptFormModel { transcriptText: string; language: string; partial: boolean; }
export interface TranscriptRequest { readonly transcriptText: string; readonly language: string | null; readonly partial: boolean; }
export const EMPTY_TRANSCRIPT_FORM: TranscriptFormModel = { transcriptText: '', language: '', partial: false };
