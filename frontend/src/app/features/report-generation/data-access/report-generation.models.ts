import type {
  ReportDetailResponse,
  ReportRequestStatus,
} from '../../reports/data-access/report.models';

export type { ReportRequestStatus } from '../../reports/data-access/report.models';

export type ReportGenerationMode =
  | 'USER_DIRECTED'
  | 'USER_DIRECTED_WITH_TRENDS'
  | 'AUTOMATIC_TREND_DISCOVERY';

export type ReportGenerationStrategy = 'SURPRISE_ME' | 'TOPIC_GUIDED';

export type CreateReportRequest = LegacyCreateReportRequest | ContextualCreateReportRequest;

export interface LegacyCreateReportRequest {
  readonly platformAccountId: string;
  readonly conversationId: string | null;
  readonly generationMode: ReportGenerationMode;
  readonly topic: string;
  readonly objective: string;
  readonly instructions: string | null;
  readonly methodology: 'HOOK_PROBLEM_SOLUTION_DIFFERENTIATOR';
  readonly selectedTrendIds: readonly string[];
  readonly ideaCount: number;
}

export interface ContextualCreateReportRequest {
  readonly platformAccountId: string;
  readonly conversationId: string | null;
  readonly generationStrategy: ReportGenerationStrategy;
  readonly topic: string | null;
  readonly objective: string | null;
  readonly instructions: string | null;
  readonly clientRequestId: string;
}

export interface ReportRequestAcceptedResponse {
  readonly requestId: string;
  readonly conversationId?: string;
  readonly status: ReportRequestStatus;
  readonly generationStrategy?: ReportGenerationStrategy;
  readonly sourceMode?: ReportSourceMode;
  readonly effectiveIdeaCount?: number;
  readonly contextSummary?: string;
}

export type ReportSourceMode =
  | 'YOUTUBE_NICHE_RANKING'
  | 'YOUTUBE_NICHE_RANKING_WITH_TOPIC'
  | 'PROFILE_AND_CHANNEL_CONTEXT'
  | 'PROFILE_CONTEXT'
  | 'LEGACY';

export interface ReportRequestResponse {
  readonly requestId: string;
  readonly conversationId?: string;
  readonly status: ReportRequestStatus;
  readonly platformAccountId?: string;
  readonly channelId?: string | null;
  readonly topic?: string | null;
  readonly objective?: string;
  readonly instructions?: string | null;
  readonly ideaCount?: number;
  readonly methodology?: 'HOOK_PROBLEM_SOLUTION_DIFFERENTIATOR';
  readonly generationMode?: ReportGenerationMode;
  readonly selectedTrendIds?: readonly string[];
  readonly trendSearchId?: string | null;
  readonly reportVersion?: number;
  readonly regeneratedFromReportId?: string | null;
  readonly processingStep?: string | null;
  readonly attemptCount?: number;
  readonly nextAttemptAt?: string | null;
  readonly failureCategory?: string | null;
  readonly reportId?: string | null;
  readonly failureCode?: string | null;
  readonly failureMessage?: string | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly startedAt?: string | null;
  readonly completedAt?: string | null;
  readonly failedAt?: string | null;
  readonly cancelledAt?: string | null;
  readonly generationStrategy?: ReportGenerationStrategy | null;
  readonly sourceMode?: ReportSourceMode | null;
  readonly effectiveIdeaCount?: number | null;
  readonly contextSummary?: string | null;
  readonly contextCapturedAt?: string | null;
  readonly originalUserQuery?: string;
  readonly progressPercent?: number;
  readonly progressMessage?: string;
  readonly terminal?: boolean;
  readonly resultAvailable?: boolean;
}

export type ReportPreviewResponse = Pick<
  ReportDetailResponse,
  'id' | 'requestId' | 'platformAccountId' | 'channelId' | 'title' | 'summary' | 'generatedAt'
>;

export interface ReportGenerationFormModel {
  generationStrategy: ReportGenerationStrategy;
  topic: string;
  objective: string;
  instructions: string;
  methodology: 'HOOK_PROBLEM_SOLUTION_DIFFERENTIATOR';
  generationMode: ReportGenerationMode;
  selectedTrendIds: string[];
}

export const EMPTY_REPORT_GENERATION_FORM: ReportGenerationFormModel = {
  generationStrategy: 'SURPRISE_ME',
  topic: '',
  objective: '',
  instructions: '',
  methodology: 'HOOK_PROBLEM_SOLUTION_DIFFERENTIATOR',
  generationMode: 'USER_DIRECTED',
  selectedTrendIds: [],
};

export type ReportPollingEvent =
  | { readonly kind: 'update'; readonly request: ReportRequestResponse }
  | { readonly kind: 'temporary-error'; readonly error: unknown };

export function formModelToCreateReportRequest(
  model: ReportGenerationFormModel,
  platformAccountId: string,
  conversationId: string | null = null,
): CreateReportRequest {
  return {
    platformAccountId,
    conversationId,
    generationStrategy: model.generationStrategy,
    topic: model.generationStrategy === 'TOPIC_GUIDED' ? optionalText(model.topic) : null,
    objective: optionalText(model.objective),
    instructions: optionalText(model.instructions),
    clientRequestId: crypto.randomUUID(),
  };
}

export function isFinalReportRequestStatus(status: ReportRequestStatus): boolean {
  return status === 'COMPLETED' || status === 'NO_RELEVANT_OPPORTUNITY'
    || status === 'FAILED' || status === 'CANCELLED';
}

function optionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}
