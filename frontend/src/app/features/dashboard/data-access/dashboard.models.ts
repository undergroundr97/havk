import type {
  ReportRequestStatus,
  ReportSummaryResponse,
} from '../../reports/data-access/report.models';

export type DashboardActionType =
  | 'CONFIGURE_PROFILE'
  | 'REVIEW_PROFILE'
  | 'CONFIGURE_CHANNEL'
  | 'GENERATE_FIRST_REPORT'
  | 'FOLLOW_ACTIVE_REQUEST'
  | 'GENERATE_REPORT'
  | 'VIEW_REPORT_HISTORY';

export interface DashboardResponse {
  readonly user: DashboardUser;
  readonly platformAccount: DashboardPlatformAccount | null;
  readonly onboarding: DashboardOnboarding;
  readonly reports: DashboardReports;
  readonly recentReports: readonly ReportSummaryResponse[] | null;
  readonly activeRequest: DashboardActiveRequest | null;
  readonly recommendedAction: DashboardRecommendedAction;
  readonly youtube: DashboardYouTubeSummary | null;
  readonly channelHealth: ChannelHealth;
  readonly profileReview: DashboardProfileReview | null;
}

export interface DashboardPlatformAccount {
  readonly id: string;
  readonly platformCode: string;
  readonly displayName: string;
  readonly handle: string | null;
  readonly connectionStatus: string;
  readonly archived: boolean;
}

export interface DashboardProfileReview {
  readonly status: 'INFERRED_PENDING_REVIEW' | 'PARTIALLY_CONFIRMED' | 'CONFIRMED' | 'MANUAL' | 'INSUFFICIENT_DATA';
  readonly confirmedRequiredFields: number;
  readonly totalRequiredFields: number;
  readonly remainingRequiredFields: number;
  readonly hasNewSuggestions: boolean;
  readonly target: '/perfil/revisao';
}

export type ChannelHealthStatus = 'SUCCESS' | 'PARTIAL' | 'EMPTY' | 'ERROR' | 'INTEGRATION_UNAVAILABLE';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface ChannelHealth {
  readonly status: ChannelHealthStatus;
  readonly source: 'SIMULATED' | 'YOUTUBE' | null;
  readonly simulated: boolean;
  readonly analyzedAt: string | null;
  readonly publicationFrequency: ChannelHealthInsight | null;
  readonly consistency: ChannelHealthInsight | null;
  readonly highestEngagement: ChannelHealthInsight | null;
  readonly peakRetention: ChannelHealthInsight | null;
  readonly bestDay: ChannelHealthInsight | null;
  readonly bestTime: ChannelHealthInsight | null;
  readonly bestFormat: ChannelHealthInsight | null;
}

export interface ChannelHealthInsight {
  readonly value: string | null;
  readonly explanation: string;
  readonly criterion: string;
  readonly confidence: ChannelHealthConfidence;
  readonly insufficientData: boolean;
}

export interface ChannelHealthConfidence {
  readonly score: number;
  readonly level: ConfidenceLevel;
}

export interface DashboardYouTubeSummary {
  readonly connectionStatus: string;
  readonly synchronizationStatus: string | null;
  readonly source: 'SIMULATED' | 'YOUTUBE' | null;
  readonly simulated: boolean;
  readonly lastSynchronizedAt: string | null;
  readonly subscriberCount: number | null;
  readonly channelViewCount: number | null;
  readonly channelVideoCount: number | null;
  readonly periodViews: number | null;
  readonly estimatedMinutesWatched: number | null;
  readonly averageViewDurationSeconds: number | null;
  readonly subscribersGained: number | null;
  readonly subscribersLost: number | null;
  readonly limitations: string | null;
  readonly failureCode: string | null;
}

export interface DashboardUser {
  readonly name: string | null;
}

export interface DashboardOnboarding {
  readonly accountCreated: boolean;
  readonly profileConfigured: boolean;
  readonly channelRegistered: boolean;
  readonly firstReportGenerated: boolean;
  readonly channel: DashboardChannel | null;
}

export interface DashboardChannel {
  readonly id: string;
  readonly name: string;
}

export interface DashboardReports {
  readonly totalReports: number;
  readonly totalIdeas: number;
  readonly lastGeneratedAt: string | null;
}

export interface DashboardActiveRequest {
  readonly requestId: string;
  readonly status: Exclude<
    ReportRequestStatus,
    'COMPLETED' | 'NO_RELEVANT_OPPORTUNITY' | 'FAILED' | 'CANCELLED'
  >;
  readonly processingStep: string | null;
  readonly requestedTopic: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DashboardRecommendedAction {
  readonly type: DashboardActionType;
  readonly title: string;
  readonly description: string;
  readonly target: string;
}
