import { ReportRequestResponse } from '../../report-generation/data-access/report-generation.models';
import { ReportDetailResponse } from '../../reports/data-access/report.models';

export type ConversationEntryType =
  | 'USER_REQUEST'
  | 'SYSTEM_PROGRESS'
  | 'TREND_DISCOVERY'
  | 'TREND_SELECTION'
  | 'REPORT_RESULT'
  | 'USER_REFINEMENT'
  | 'WARNING'
  | 'ERROR'
  | 'INFORMATION';

export interface ReportConversationSummary {
  readonly id: string;
  readonly platformAccountId: string;
  readonly platformCode: string;
  readonly accountDisplayName: string;
  readonly accountHandle: string | null;
  readonly title: string;
  readonly latestReportTitle: string | null;
  readonly latestReportGeneratedAt: string | null;
  readonly status: 'ACTIVE' | 'ARCHIVED';
  readonly hasActiveRequest: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
  readonly researchMode: ResearchMode | null;
}

export interface ConversationEntry {
  readonly id: string;
  readonly entryType: ConversationEntryType;
  readonly sequence: number;
  readonly displayText: string;
  readonly reportRequestId: string | null;
  readonly reportId: string | null;
  readonly trendSearchId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface ReportConversationDetail {
  readonly conversation: ReportConversationSummary;
  readonly entries: readonly ConversationEntry[];
  readonly requests: readonly ReportRequestResponse[];
  readonly reports: readonly ReportDetailResponse[];
}

export type WorkspaceFeedItem =
  | {
      readonly key: `entry:${string}`;
      readonly kind: 'entry';
      readonly occurredAt: string;
      readonly sequence: number;
      readonly entry: ConversationEntry;
    }
  | {
      readonly key: `request:${string}`;
      readonly kind: 'request';
      readonly occurredAt: string;
      readonly sequence: number;
      readonly request: ReportRequestResponse;
    }
  | {
      readonly key: `report:${string}`;
      readonly kind: 'report';
      readonly occurredAt: string;
      readonly sequence: number;
      readonly report: ReportDetailResponse;
    };

export interface WorkspaceComposerModel {
  message: string;
}

export const EMPTY_WORKSPACE_COMPOSER: WorkspaceComposerModel = {
  message: '',
};

export type WorkspaceGenerationMode =
  | 'USER_DIRECTED'
  | 'USER_DIRECTED_WITH_TRENDS'
  | 'AUTOMATIC_TREND_DISCOVERY';

export type ResearchMode = 'SURPRISE_ME' | 'SEARCH';

export interface WorkspaceMessageRequest {
  readonly messageId: string;
  readonly platformAccountId: string;
  readonly conversationId: string | null;
  readonly message: string;
  readonly researchMode: ResearchMode;
}

export interface WorkspaceMessageInterpretation {
  readonly generationMode: WorkspaceGenerationMode;
  readonly subject: string | null;
  readonly objective: string | null;
  readonly additionalInstructions: string | null;
  readonly useCurrentTrends: boolean;
  readonly automaticDiscovery: boolean;
  readonly confidence: number;
  readonly clarificationRequired: boolean;
  readonly clarificationQuestion: string | null;
  readonly interpretedLanguage: string;
  readonly providerReference: string;
  readonly modelReference: string;
  readonly simulated: boolean;
}

export interface WorkspaceMessageResponse {
  readonly messageId: string;
  readonly conversationId: string;
  readonly requestId: string | null;
  readonly clarificationRequired: boolean;
  readonly clarificationQuestion: string | null;
  readonly interpretation: WorkspaceMessageInterpretation | null;
  readonly researchMode: ResearchMode;
  readonly outcome: 'CLARIFICATION_REQUIRED' | 'RESEARCH_STARTED';
  readonly assistantMessage: string;
}
