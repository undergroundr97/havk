import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { AuthSessionState, AuthSessionStore } from '../../../core/auth/auth-session.store';
import { ReportPollingEvent } from '../../report-generation/data-access/report-generation.models';
import { ReportGenerationService } from '../../report-generation/data-access/report-generation.service';
import { WorkspaceExecutionTracker } from './workspace-execution-tracker.service';
import { WorkspaceSessionStore, WorkspaceTrackingContext } from './workspace-session.store';

describe('WorkspaceExecutionTracker', () => {
  const authState = signal<AuthSessionState>(authenticatedState());
  const progress = new Subject<ReportPollingEvent>();
  const watchRequest = vi.fn(() => progress.asObservable());
  const applyTrackingUpdate = vi.fn();
  const setTrackingWarning = vi.fn();
  const needsTerminalHydration = vi.fn(() => false);
  const loadConversation = vi.fn(async () => ({ requests: [], reports: [] }));
  let tracker: WorkspaceExecutionTracker;

  beforeEach(() => {
    authState.set(authenticatedState());
    watchRequest.mockClear();
    applyTrackingUpdate.mockClear();
    setTrackingWarning.mockClear();
    needsTerminalHydration.mockReset().mockReturnValue(false);
    loadConversation.mockClear();
    TestBed.configureTestingModule({ providers: [
      { provide: AuthSessionStore, useValue: {
        session: authState,
        user: computed(() => authState().user),
      } },
      { provide: ReportGenerationService, useValue: { watchRequest } },
      { provide: WorkspaceSessionStore, useValue: {
        applyTrackingUpdate, setTrackingWarning, needsTerminalHydration, loadConversation,
      } },
    ] });
    tracker = TestBed.inject(WorkspaceExecutionTracker);
    TestBed.flushEffects();
  });

  afterEach(() => tracker.stopAll());

  it('owns exactly one cold SSE subscription per requestId', () => {
    tracker.ensure('request-1', CONTEXT);
    tracker.ensure('request-1', CONTEXT);

    expect(watchRequest).toHaveBeenCalledOnce();
    expect(progress.observed).toBe(true);
    expect(tracker.activeCount()).toBe(1);
  });

  it('keeps hidden execution updates and hydrates a completed result at most once', async () => {
    needsTerminalHydration.mockReturnValue(true);
    tracker.ensure('request-1', CONTEXT);
    progress.next({ kind: 'update', request: {
      requestId: 'request-1',
      conversationId: CONTEXT.conversationId,
      status: 'COMPLETED',
      reportId: 'report-1',
      resultAvailable: true,
    } });
    progress.next({ kind: 'update', request: {
      requestId: 'request-1',
      conversationId: CONTEXT.conversationId,
      status: 'COMPLETED',
      reportId: 'report-1',
      resultAvailable: true,
    } });
    await Promise.resolve();

    expect(applyTrackingUpdate).toHaveBeenCalledOnce();
    expect(loadConversation).toHaveBeenCalledOnce();
    expect(tracker.activeCount()).toBe(0);
  });

  it('cancels active trackers when the authenticated user leaves', () => {
    tracker.ensure('request-1', CONTEXT);
    authState.set({ status: 'anonymous', user: null, message: null });
    TestBed.flushEffects();

    expect(progress.observed).toBe(false);
    expect(tracker.activeCount()).toBe(0);
  });

  it('treats NO_RELEVANT_OPPORTUNITY as terminal product state without detail hydration', () => {
    tracker.ensure('request-1', CONTEXT);
    progress.next({ kind: 'update', request: {
      requestId: 'request-1',
      conversationId: CONTEXT.conversationId,
      status: 'NO_RELEVANT_OPPORTUNITY',
      terminal: true,
      resultAvailable: false,
    } });

    expect(applyTrackingUpdate).toHaveBeenCalledOnce();
    expect(loadConversation).not.toHaveBeenCalled();
    expect(tracker.activeCount()).toBe(0);
  });
});

const CONTEXT: WorkspaceTrackingContext = {
  userId: 'user-a',
  platformAccountId: 'account-a',
  researchMode: 'SURPRISE_ME',
  conversationId: 'conversation-1',
};

function authenticatedState(): AuthSessionState {
  return {
    status: 'authenticated',
    user: {
      id: 'user-a', name: 'User', email: 'user@example.com', status: 'ACTIVE',
      createdAt: '2026-09-11T09:00:00Z', updatedAt: '2026-09-11T09:00:00Z',
    },
    message: null,
  };
}
