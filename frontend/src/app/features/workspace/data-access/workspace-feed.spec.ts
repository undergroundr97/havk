import { ReportConversationDetail } from './workspace.models';
import { composeWorkspaceFeed } from './workspace-feed';

describe('composeWorkspaceFeed', () => {
  it('composes, orders and deduplicates aggregate items with stable keys', () => {
    const detail = fixture();
    const items = composeWorkspaceFeed({
      ...detail,
      requests: [...detail.requests, detail.requests[0]!],
      reports: [...detail.reports, detail.reports[0]!],
    });

    expect(items.map((item) => item.key)).toEqual([
      `entry:${ENTRY_ID}`,
      `request:${REQUEST_ID}`,
      `report:${REPORT_ID}`,
    ]);
  });

  it('isolates reports by conversation and platform account without confusing ids', () => {
    const detail = fixture();
    const foreign = {
      ...detail.reports[0]!,
      id: '00000000-0000-4000-8000-000000000099',
      conversationId: '00000000-0000-4000-8000-000000000098',
    };
    const items = composeWorkspaceFeed({ ...detail, reports: [...detail.reports, foreign] });

    expect(items.filter((item) => item.kind === 'report')).toHaveLength(1);
    expect(items.some((item) => item.key === `report:${REQUEST_ID}`)).toBe(false);
  });
});

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000001';
const CONVERSATION_ID = '00000000-0000-4000-8000-000000000002';
const ENTRY_ID = '00000000-0000-4000-8000-000000000003';
const REQUEST_ID = '00000000-0000-4000-8000-000000000004';
const REPORT_ID = '00000000-0000-4000-8000-000000000005';

function fixture(): ReportConversationDetail {
  return {
    conversation: {
      id: CONVERSATION_ID, platformAccountId: ACCOUNT_ID, platformCode: 'YOUTUBE',
      accountDisplayName: 'Canal HAVK', accountHandle: '@havk', title: 'Conversa',
      latestReportTitle: null, latestReportGeneratedAt: null, status: 'ACTIVE',
      hasActiveRequest: false, createdAt: '2026-07-29T10:00:00Z',
      updatedAt: '2026-07-29T10:03:00Z', archivedAt: null, researchMode: 'SEARCH',
    },
    entries: [{
      id: ENTRY_ID, entryType: 'USER_REQUEST', sequence: 1, displayText: 'Pedido',
      reportRequestId: REQUEST_ID, reportId: null, trendSearchId: null, metadata: {},
      createdAt: '2026-07-29T10:00:00Z',
    }],
    requests: [{
      requestId: REQUEST_ID, conversationId: CONVERSATION_ID, platformAccountId: ACCOUNT_ID,
      status: 'COMPLETED', reportId: REPORT_ID, createdAt: '2026-07-29T10:01:00Z',
      completedAt: '2026-07-29T10:02:00Z',
    }],
    reports: [{
      id: REPORT_ID, requestId: REQUEST_ID, conversationId: CONVERSATION_ID,
      platformAccountId: ACCOUNT_ID, platformCode: 'YOUTUBE', platformHandle: '@havk',
      channelId: null, channelName: 'Canal HAVK', requestedTopic: 'Tema', objective: 'Objetivo',
      title: 'Relatório', summary: 'Resumo', simulated: false, dataCollectedAt: null,
      generatedAt: '2026-07-29T10:03:00Z', createdAt: '2026-07-29T10:03:00Z',
      ideas: [], sources: [], sections: [], trends: [],
    }],
  };
}
