import { ReportRequestResponse } from '../../report-generation/data-access/report-generation.models';
import { parseReportRequest } from '../../report-generation/data-access/report-generation.service';
import { parseReportDetail, isReportIdentifier } from '../../reports/data-access/report-response.parser';
import {
  ConversationEntry,
  ConversationEntryType,
  ReportConversationDetail,
  ReportConversationSummary,
  WorkspaceGenerationMode,
  ResearchMode,
  WorkspaceMessageResponse,
} from './workspace.models';

const ENTRY_TYPES = new Set<ConversationEntryType>([
  'USER_REQUEST', 'SYSTEM_PROGRESS', 'TREND_DISCOVERY', 'TREND_SELECTION', 'REPORT_RESULT',
  'USER_REFINEMENT', 'WARNING', 'ERROR', 'INFORMATION',
]);
const GENERATION_MODES = new Set<WorkspaceGenerationMode>([
  'USER_DIRECTED', 'USER_DIRECTED_WITH_TRENDS', 'AUTOMATIC_TREND_DISCOVERY',
]);
const RESEARCH_MODES = new Set<ResearchMode>(['SURPRISE_ME', 'SEARCH']);

export function parseWorkspaceMessageResponse(value: unknown): WorkspaceMessageResponse {
  const item = record(value);
  const researchMode = item['researchMode'];
  if (typeof researchMode === 'string' && RESEARCH_MODES.has(researchMode as ResearchMode)) {
    const outcome = text(item['outcome']);
    if (outcome !== 'CLARIFICATION_REQUIRED' && outcome !== 'RESEARCH_STARTED') {
      throw new Error('Resultado da conversa semântica inválido.');
    }
    return {
      messageId: uuid(item['messageId']), conversationId: uuid(item['conversationId']),
      requestId: nullableUuid(item['requestId']), clarificationRequired: outcome === 'CLARIFICATION_REQUIRED',
      clarificationQuestion: nullableText(item['clarificationQuestion']), interpretation: null,
      researchMode: researchMode as ResearchMode, outcome, assistantMessage: text(item['assistantMessage']),
    };
  }
  const interpretation = record(item['interpretation']);
  const generationMode = text(interpretation['generationMode']);
  if (!GENERATION_MODES.has(generationMode as WorkspaceGenerationMode)) {
    throw new Error('Modo de interpretação inválido.');
  }
  const confidence = interpretation['confidence'];
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error('Confiança de interpretação inválida.');
  }
  return {
    messageId: uuid(item['messageId']),
    conversationId: uuid(item['conversationId']),
    requestId: nullableUuid(item['requestId']),
    clarificationRequired: bool(item['clarificationRequired']),
    clarificationQuestion: nullableText(item['clarificationQuestion']),
    interpretation: {
      generationMode: generationMode as WorkspaceGenerationMode,
      subject: nullableText(interpretation['subject']),
      objective: nullableText(interpretation['objective']),
      additionalInstructions: nullableText(interpretation['additionalInstructions']),
      useCurrentTrends: bool(interpretation['useCurrentTrends']),
      automaticDiscovery: bool(interpretation['automaticDiscovery']),
      confidence,
      clarificationRequired: bool(interpretation['clarificationRequired']),
      clarificationQuestion: nullableText(interpretation['clarificationQuestion']),
      interpretedLanguage: text(interpretation['interpretedLanguage']),
      providerReference: text(interpretation['providerReference']),
      modelReference: text(interpretation['modelReference']),
      simulated: bool(interpretation['simulated']),
    },
    researchMode: 'SEARCH',
    outcome: bool(item['clarificationRequired']) ? 'CLARIFICATION_REQUIRED' : 'RESEARCH_STARTED',
    assistantMessage: nullableText(item['clarificationQuestion']) ?? 'Pesquisa iniciada.',
  };
}

export function parseConversationList(value: unknown): readonly ReportConversationSummary[] {
  if (!Array.isArray(value)) throw new Error('Lista de conversas inválida.');
  return value.map(parseConversationSummary);
}

export function parseConversationDetail(value: unknown): ReportConversationDetail {
  const item = record(value);
  const conversation = parseConversationSummary(item['conversation']);
  const entries = optionalArray(item['entries']).map(parseEntry)
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
  const requests = optionalArray(item['requests']).map(parseReportRequest);
  return {
    conversation,
    entries,
    requests,
    reports: optionalArray(item['reports']).map((report) =>
      parseWorkspaceReport(report, conversation, requests)),
  };
}

function parseWorkspaceReport(
  value: unknown,
  conversation: ReportConversationSummary,
  requests: readonly ReportRequestResponse[],
) {
  const report = record(value);
  const requestId = typeof report['requestId'] === 'string' ? report['requestId'] : null;
  const request = requestId ? requests.find((candidate) => candidate.requestId === requestId) : undefined;
  const timestamp = firstInstant(
    report['generatedAt'], report['createdAt'], request?.completedAt, request?.updatedAt,
    conversation.updatedAt,
  );
  return parseReportDetail({
    ...report,
    conversationId: report['conversationId'] ?? conversation.id,
    platformAccountId: report['platformAccountId'] ?? conversation.platformAccountId,
    platformCode: report['platformCode'] ?? conversation.platformCode,
    platformHandle: report['platformHandle'] ?? conversation.accountHandle,
    channelId: report['channelId'] ?? null,
    channelName: report['channelName'] ?? conversation.accountDisplayName,
    requestedTopic: report['requestedTopic'] ?? request?.topic ?? null,
    objective: report['objective'] ?? request?.objective,
    dataCollectedAt: report['dataCollectedAt'] ?? null,
    generatedAt: report['generatedAt'] ?? timestamp,
    createdAt: report['createdAt'] ?? timestamp,
    ideas: optionalArray(report['ideas']),
    sources: optionalArray(report['sources']),
    sections: optionalArray(report['sections']),
    trends: optionalArray(report['trends']),
  });
}

function parseConversationSummary(value: unknown): ReportConversationSummary {
  const item = record(value);
  const status = text(item['status']);
  if (status !== 'ACTIVE' && status !== 'ARCHIVED') throw new Error('Status de conversa inválido.');
  return {
    id: uuid(item['id']),
    platformAccountId: uuid(item['platformAccountId']),
    platformCode: text(item['platformCode']),
    accountDisplayName: text(item['accountDisplayName']),
    accountHandle: nullableText(item['accountHandle']),
    title: text(item['title']),
    latestReportTitle: nullableText(item['latestReportTitle']),
    latestReportGeneratedAt: nullableInstant(item['latestReportGeneratedAt']),
    status,
    hasActiveRequest: bool(item['hasActiveRequest']),
    createdAt: instant(item['createdAt']),
    updatedAt: instant(item['updatedAt']),
    archivedAt: nullableInstant(item['archivedAt']),
    researchMode: nullableResearchMode(item['researchMode']),
  };
}

function parseEntry(value: unknown): ConversationEntry {
  const item = record(value);
  const entryType = text(item['entryType']);
  if (!ENTRY_TYPES.has(entryType as ConversationEntryType)) throw new Error('Tipo de entrada inválido.');
  const sequence = item['sequence'];
  if (!Number.isSafeInteger(sequence) || (sequence as number) < 1) throw new Error('Sequência inválida.');
  return {
    id: uuid(item['id']),
    entryType: entryType as ConversationEntryType,
    sequence: sequence as number,
    displayText: text(item['displayText']),
    reportRequestId: nullableUuid(item['reportRequestId']),
    reportId: nullableUuid(item['reportId']),
    trendSearchId: nullableUuid(item['trendSearchId']),
    metadata: record(item['metadata']),
    createdAt: instant(item['createdAt']),
  };
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Resposta inválida.');
  return value as Record<string, unknown>;
}
function optionalArray(value: unknown): readonly unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Lista inválida.');
  return value;
}
function text(value: unknown): string { if (typeof value !== 'string' || !value.trim()) throw new Error('Texto inválido.'); return value; }
function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw new Error('Booleano inválido.'); return value; }
function uuid(value: unknown): string { const result = text(value); if (!isReportIdentifier(result)) throw new Error('Identificador inválido.'); return result; }
function nullableUuid(value: unknown): string | null { return value === null || value === undefined ? null : uuid(value); }
function nullableText(value: unknown): string | null { return value === null || value === undefined ? null : text(value); }
function instant(value: unknown): string { const result = text(value); if (Number.isNaN(Date.parse(result))) throw new Error('Data inválida.'); return result; }
function nullableInstant(value: unknown): string | null { return value === null || value === undefined ? null : instant(value); }
function nullableResearchMode(value: unknown): ResearchMode | null {
  if (value === null || value === undefined) return null;
  const result = text(value);
  if (!RESEARCH_MODES.has(result as ResearchMode)) throw new Error('Modo de pesquisa inválido.');
  return result as ResearchMode;
}
function firstInstant(...values: readonly unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value;
  }
  throw new Error('Data do relatório inválida.');
}
