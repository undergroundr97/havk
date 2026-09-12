import { describe, expect, it } from 'vitest';

import { isFinalReportRequestStatus } from '../../report-generation/data-access/report-generation.models';
import {
  parseConversationList,
  parseWorkspaceMessageResponse,
} from './workspace.parser';

const MESSAGE_ID = '00000000-0000-4000-8000-000000000331';
const CONVERSATION_ID = '00000000-0000-4000-8000-000000000332';
const REQUEST_ID = '00000000-0000-4000-8000-000000000333';

describe('F33 workspace contracts', () => {
  it('parses a clarification without creating a report request', () => {
    const response = parseWorkspaceMessageResponse({
      messageId: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      requestId: null,
      researchMode: 'SEARCH',
      outcome: 'CLARIFICATION_REQUIRED',
      assistantMessage: 'Você está falando do planeta ou de outro assunto?',
      clarificationQuestion: 'Você está falando do planeta ou de outro assunto?',
    });

    expect(response.researchMode).toBe('SEARCH');
    expect(response.clarificationRequired).toBe(true);
    expect(response.requestId).toBeNull();
  });

  it('parses a started search and preserves its persisted mode across refresh', () => {
    const response = parseWorkspaceMessageResponse({
      messageId: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      requestId: REQUEST_ID,
      researchMode: 'SEARCH',
      outcome: 'RESEARCH_STARTED',
      assistantMessage: 'Pesquisa iniciada.',
      clarificationQuestion: null,
    });
    const conversations = parseConversationList([{
      id: CONVERSATION_ID,
      platformAccountId: REQUEST_ID,
      platformCode: 'YOUTUBE',
      accountDisplayName: 'Canal',
      accountHandle: '@canal',
      title: 'Java Spring Boot',
      latestReportTitle: null,
      latestReportGeneratedAt: null,
      status: 'ACTIVE',
      hasActiveRequest: true,
      createdAt: '2026-09-10T12:00:00Z',
      updatedAt: '2026-09-10T12:00:00Z',
      archivedAt: null,
      researchMode: 'SEARCH',
    }]);

    expect(response.requestId).toBe(REQUEST_ID);
    expect(conversations[0]?.researchMode).toBe('SEARCH');
  });

  it('rejects unknown modes and treats no relevant opportunity as terminal product state', () => {
    expect(() => parseWorkspaceMessageResponse({
      messageId: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      requestId: null,
      researchMode: 'AUTO',
      outcome: 'RESEARCH_STARTED',
      assistantMessage: 'Pesquisa iniciada.',
    })).toThrow();
    expect(isFinalReportRequestStatus('NO_RELEVANT_OPPORTUNITY')).toBe(true);
  });
});
