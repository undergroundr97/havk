import { ReportRequestResponse } from '../../report-generation/data-access/report-generation.models';
import { ReportDetailResponse } from '../../reports/data-access/report.models';
import { ReportConversationDetail, WorkspaceFeedItem } from './workspace.models';

export function composeWorkspaceFeed(detail: ReportConversationDetail): readonly WorkspaceFeedItem[] {
  const { id: conversationId, platformAccountId } = detail.conversation;
  const requests = uniqueBy(detail.requests.filter((request) =>
    (!request.conversationId || request.conversationId === conversationId)
      && (!request.platformAccountId || request.platformAccountId === platformAccountId)),
  (request) => request.requestId, (request) => requestTimestamp(request, detail.conversation.updatedAt));
  const reports = uniqueBy(detail.reports.filter((report) =>
    report.conversationId === conversationId && report.platformAccountId === platformAccountId),
  (report) => report.id, reportTimestamp);
  const reportIds = new Set(reports.map((report) => report.id));
  const requestIds = new Set(requests.map((request) => request.requestId));
  const entries = uniqueBy(detail.entries.filter((entry) =>
    !(entry.entryType === 'REPORT_RESULT' && entry.reportId && reportIds.has(entry.reportId))
      && !(entry.entryType === 'SYSTEM_PROGRESS' && entry.reportRequestId
        && requestIds.has(entry.reportRequestId))),
  (entry) => entry.id, (entry) => entry.createdAt);

  const items: WorkspaceFeedItem[] = [
    ...entries.map((entry): WorkspaceFeedItem => ({
      key: `entry:${entry.id}`,
      kind: 'entry',
      occurredAt: entry.createdAt,
      sequence: entry.sequence,
      entry,
    })),
    ...requests.map((request, index): WorkspaceFeedItem => {
      const linkedEntry = detail.entries.find((entry) => entry.reportRequestId === request.requestId);
      return {
        key: `request:${request.requestId}`,
        kind: 'request',
        occurredAt: linkedEntry?.createdAt ?? requestTimestamp(request, detail.conversation.updatedAt),
        sequence: linkedEntry ? linkedEntry.sequence + .1
          : Number.MAX_SAFE_INTEGER - reports.length - requests.length + index,
        request,
      };
    }),
    ...reports.map((report, index): WorkspaceFeedItem => ({
      key: `report:${report.id}`,
      kind: 'report',
      occurredAt: reportTimestamp(report),
      sequence: Number.MAX_SAFE_INTEGER - reports.length + index,
      report,
    })),
  ];

  return items.sort((left, right) =>
    Date.parse(left.occurredAt) - Date.parse(right.occurredAt)
      || left.sequence - right.sequence
      || left.key.localeCompare(right.key));
}

function requestTimestamp(request: ReportRequestResponse, fallback: string): string {
  return request.completedAt ?? request.createdAt ?? request.updatedAt ?? fallback;
}

function reportTimestamp(report: ReportDetailResponse): string {
  return report.createdAt || report.generatedAt;
}

function uniqueBy<T>(
  values: readonly T[],
  id: (value: T) => string,
  timestamp: (value: T) => string,
): readonly T[] {
  const unique = new Map<string, T>();
  for (const value of values) {
    const current = unique.get(id(value));
    if (!current || Date.parse(timestamp(value)) >= Date.parse(timestamp(current))) {
      unique.set(id(value), value);
    }
  }
  return [...unique.values()];
}
