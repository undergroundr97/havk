export type ReportRequestStatus =
  | 'QUEUED'
  | 'DISCOVERING_CONTENT'
  | 'SELECTING_CONTENT'
  | 'ANALYZING_CONTENT'
  | 'FINDING_OPPORTUNITIES'
  | 'BUILDING_STRATEGY'
  | 'GENERATING_REPORT'
  | 'COMPLETED'
  | 'NO_RELEVANT_OPPORTUNITY'
  | 'FAILED'
  | 'CANCELLED';

export type ReportFinalStatus = Extract<
  ReportRequestStatus,
  'COMPLETED' | 'NO_RELEVANT_OPPORTUNITY' | 'FAILED' | 'CANCELLED'
>;

export interface PageResponse<T> {
  readonly content: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
  readonly first: boolean;
  readonly last: boolean;
}

export interface ReportSummaryResponse {
  readonly id: string;
  readonly requestId: string;
  readonly conversationId?: string;
  readonly platformAccountId: string;
  readonly platformCode: string;
  readonly platformHandle: string | null;
  readonly channelId: string | null;
  readonly title: string;
  readonly summary: string;
  readonly generatedAt: string;
  readonly createdAt: string;
  readonly channelName: string;
  readonly requestedTopic: string | null;
  readonly requestedIdeaCount: number;
  readonly methodology?: string;
  readonly generationMode?: string;
  readonly reportVersion?: number;
  readonly simulated?: boolean;
  readonly status: ReportFinalStatus;
}

export interface ReportDetailResponse {
  readonly id: string;
  readonly requestId: string;
  readonly conversationId?: string;
  readonly platformAccountId: string;
  readonly platformCode: string;
  readonly platformHandle: string | null;
  readonly channelId: string | null;
  readonly channelName: string;
  readonly requestedTopic: string | null;
  readonly objective?: string;
  readonly title: string;
  readonly summary: string;
  readonly methodology?: string;
  readonly generationMode?: string;
  readonly simulated?: boolean;
  readonly providerVersion?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly reportVersion?: number;
  readonly regeneratedFromReportId?: string | null;
  readonly lineageRootReportId?: string;
  readonly contextSufficiency?: string;
  readonly contextConfidence?: number;
  readonly primaryNiche?: string | null;
  readonly targetAudience?: string | null;
  readonly language?: string | null;
  readonly region?: string | null;
  readonly recommendedFormat?: string | null;
  readonly formatRecommendationReason?: string;
  readonly formatDecision?: FormatDecisionResponse | null;
  readonly totalEstimatedDurationSeconds?: number | null;
  readonly totalEstimatedDurationLabel?: string | null;
  readonly estimatedWordCount?: number | null;
  readonly speakingRateWordsPerMinute?: number | null;
  readonly scriptContractVersion?: string | null;
  readonly schemaVersion?: string | null;
  readonly promptVersion?: string | null;
  readonly evidenceSummary?: readonly ReportEvidenceResponse[];
  readonly generationNotice?: string;
  readonly dataCollectedAt: string | null;
  readonly generatedAt: string;
  readonly createdAt: string;
  readonly ideas: readonly VideoIdeaResponse[];
  readonly sources: readonly ReportSourceResponse[];
  readonly sections?: readonly ReportSectionResponse[];
  readonly trends?: readonly ReportTrendSnapshotResponse[];
  readonly generationContext?: ReportGenerationContextResponse | null;
}

export interface ReportGenerationContextResponse {
  readonly generationStrategy: 'SURPRISE_ME' | 'TOPIC_GUIDED';
  readonly sourceMode: 'YOUTUBE_NICHE_RANKING' | 'YOUTUBE_NICHE_RANKING_WITH_TOPIC'
    | 'PROFILE_AND_CHANNEL_CONTEXT' | 'PROFILE_CONTEXT';
  readonly capturedAt: string;
  readonly effectiveIdeaCount: number;
  readonly contextSummary: string;
  readonly limitations: string;
  readonly opportunities: readonly ReportOpportunityContextResponse[];
}

export interface ReportOpportunityContextResponse {
  readonly contextId: string;
  readonly collectionRunId: string;
  readonly rankingRunId: string;
  readonly opportunityId: string;
  readonly selectionPosition: number;
  readonly rankingPosition: number;
  readonly displayTopic: string;
  readonly rankingScore: number;
  readonly confidence: string;
  readonly selectionScore: number;
  readonly selectionReasons: string;
  readonly explanation: string;
  readonly algorithmVersion: string;
  readonly observedAt: string;
  readonly evidences: readonly ReportOpportunityEvidenceResponse[];
}

export interface ReportOpportunityEvidenceResponse {
  readonly position: number;
  readonly externalVideoId: string;
  readonly title: string;
  readonly publicUrl: string;
  readonly publicChannelName: string | null;
  readonly publishedAt: string;
  readonly publicMetrics: Readonly<Record<string, number>>;
}

export interface ReportSectionResponse {
  readonly key: string;
  readonly content: string;
  readonly purpose: string | null;
  readonly reasoning: string | null;
  readonly impact: string | null;
  readonly context: string | null;
  readonly consequence: string | null;
  readonly relationship: string | null;
  readonly expectedOutcome: string | null;
  readonly variations: readonly string[];
  readonly keyPoints: readonly string[];
  readonly evidence: readonly string[];
  readonly spokenScript?: string | null;
  readonly transitionToNextSection?: string | null;
  readonly modelEstimatedSeconds?: number | null;
  readonly calculatedSpeechSeconds?: number | null;
  readonly estimatedSpeechSeconds?: number | null;
  readonly estimatedSpeechLabel?: string | null;
  readonly startSecond?: number | null;
  readonly endSecond?: number | null;
  readonly deliveryNotes?: string | null;
  readonly structuredEvidence?: readonly ReportEvidenceResponse[];
}

export type RecommendedContentFormat =
  | 'SHORT_FORM'
  | 'STANDARD_VIDEO'
  | 'LONG_FORM'
  | 'LIVE'
  | 'OTHER';

export interface FormatDecisionResponse {
  readonly format: RecommendedContentFormat;
  readonly reason: string;
  readonly confidence: number;
  readonly metricsUsed: readonly string[];
  readonly limitations: readonly string[];
  readonly targetDurationSeconds: number;
  readonly historicalAffinity?: number | null;
  readonly historicalEvidenceCount?: number;
  readonly alternatives?: readonly ContentFormatOptionResponse[];
}

export interface ContentFormatOptionResponse {
  readonly format: RecommendedContentFormat;
  readonly historicalAffinity: number;
  readonly confidence: number;
  readonly evidenceCount: number;
  readonly recentUsagePenalty: number;
}

export interface ReportEvidenceResponse {
  readonly type:
    | 'SOURCE_FACT'
    | 'CONTENT_HISTORY_FACT'
    | 'ACCOUNT_METRIC'
    | 'HAVK_CALCULATION'
    | 'HAVK_RECOMMENDATION';
  readonly claim: string;
  readonly contentItemId: string | null;
  readonly metricSnapshotId: string | null;
  readonly sourceId: string | null;
}

export interface ReportTrendSnapshotResponse {
  readonly trendResultId: string;
  readonly title: string;
  readonly factualSummary: string;
  readonly originalUrl: string;
  readonly sourceName: string;
  readonly sourceType: string;
  readonly sourceReliability: string;
  readonly authorOrInstitution: string | null;
  readonly publishedAt: string | null;
  readonly collectedAt: string;
  readonly evidence: readonly string[];
  readonly relevanceReason: string;
  readonly relevance: number;
  readonly rankingConfidence: number;
  readonly freshnessStatus: string;
  readonly realData: boolean;
}

export interface VideoIdeaResponse {
  readonly id: string;
  readonly position: number;
  readonly provisionalTitle: string;
  readonly summary: string;
  readonly relatedTrend: string;
  readonly compatibilityJustification: string;
  readonly hook: string;
  readonly problem: string;
  readonly solution: string;
  readonly differentiator: string;
  readonly targetAudience: string;
  readonly notes: string;
  readonly relevanceLevel: string | null;
  readonly competitionLevel: string | null;
  readonly urgencyLevel: string | null;
  readonly keywords: readonly string[];
  readonly risks: readonly string[];
  readonly limitations: readonly string[];
  readonly opportunities?: readonly VideoIdeaOpportunityLinkResponse[];
}

export interface VideoIdeaOpportunityLinkResponse {
  readonly opportunityContextId: string;
  readonly displayTopic: string;
  readonly relationType: 'PRIMARY' | 'SUPPORTING';
  readonly position: number;
}

export interface ReportSourceResponse {
  readonly id: string;
  readonly videoIdeaId: string | null;
  readonly position: number;
  readonly sourceType: string;
  readonly sourceName: string;
  readonly title: string;
  readonly reference: string;
  readonly publisher: string | null;
  readonly publishedAt: string | null;
  readonly collectedAt: string;
  readonly trendResultId?: string | null;
  readonly sourceReliability?: string | null;
  readonly evidence?: readonly string[];
  readonly attributionType?: string;
}

export interface ReportRegenerationResponse { readonly requestId: string; readonly conversationId?: string; }
