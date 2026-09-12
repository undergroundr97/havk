import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { AuthSessionState, AuthSessionStore } from '../../../core/auth/auth-session.store';
import { ReportConversationDetail, ReportConversationSummary } from './workspace.models';
import { WorkspaceService } from './workspace.service';
import { WorkspaceSessionStore } from './workspace-session.store';

describe('WorkspaceSessionStore', () => {
  const session = signal<AuthSessionState>(authenticated('user-a'));
  const list = vi.fn<() => Observable<readonly ReportConversationSummary[]>>();
  const detail = vi.fn<(id: string) => Observable<ReportConversationDetail>>();
  let store: WorkspaceSessionStore;

  beforeEach(() => {
    session.set(authenticated('user-a'));
    list.mockReset().mockReturnValue(of([]));
    detail.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSessionStore, useValue: {
          session,
          user: computed(() => session().user),
        } },
        { provide: WorkspaceService, useValue: { list, detail } },
      ],
    });
    store = TestBed.inject(WorkspaceSessionStore);
    TestBed.flushEffects();
  });

  it('keeps global history and one active conversation per user and account, independent of composer mode', async () => {
    list.mockReturnValue(of([
      summary('search-1', 'account-a', 'SEARCH', '2026-09-11T10:00:00Z'),
      summary('surprise-1', 'account-a', 'SURPRISE_ME', '2026-09-11T11:00:00Z'),
      summary('search-b', 'account-b', 'SEARCH', '2026-09-11T12:00:00Z'),
    ]));
    await store.ensureConversationList('user-a');

    store.activate(identity('account-a', 'SEARCH'));
    expect(store.visibleConversations().map((item) => item.id)).toEqual(['surprise-1', 'search-1']);
    expect(store.selectedConversationId()).toBe('surprise-1');

    store.activate(identity('account-a', 'SEARCH'), 'search-1');
    expect(store.selectedConversationId()).toBe('search-1');

    store.activate(identity('account-a', 'SURPRISE_ME'));
    expect(store.visibleConversations().map((item) => item.id)).toEqual(['surprise-1', 'search-1']);
    expect(store.selectedConversationId()).toBe('search-1');
    expect(store.activeResearchMode()).toBe('SURPRISE_ME');

    store.activate(identity('account-b', 'SEARCH'));
    expect(store.visibleConversations().map((item) => item.id)).toEqual(['search-b']);
  });

  it('deduplicates list and detail requests and restores cached detail without a backend fetch', async () => {
    list.mockReturnValue(of([summary('search-1', 'account-a', 'SEARCH', '2026-09-11T10:00:00Z')]));
    detail.mockReturnValue(of(conversation('search-1', 'account-a', 'SEARCH')));
    const workspaceIdentity = identity('account-a', 'SEARCH');

    await Promise.all([
      store.ensureConversationList('user-a'),
      store.ensureConversationList('user-a'),
    ]);
    store.activate(workspaceIdentity, 'search-1');
    await Promise.all([
      store.loadConversation(workspaceIdentity, 'search-1'),
      store.loadConversation(workspaceIdentity, 'search-1'),
    ]);
    await store.loadConversation(workspaceIdentity, 'search-1');

    expect(list).toHaveBeenCalledOnce();
    expect(detail).toHaveBeenCalledOnce();
    expect(store.detail()?.conversation.id).toBe('search-1');
    expect(store.conversationLoading()).toBe(false);
  });

  it('purges snapshots and rejects a late response after logout or user change', async () => {
    const response = new Subject<ReportConversationDetail>();
    detail.mockReturnValue(response);
    const workspaceIdentity = identity('account-a', 'SEARCH');
    store.activate(workspaceIdentity, 'search-1');
    const pending = store.loadConversation(workspaceIdentity, 'search-1');

    session.set(authenticated('user-b'));
    TestBed.flushEffects();
    response.next(conversation('search-1', 'account-a', 'SEARCH'));
    response.complete();

    await expect(pending).rejects.toThrow('sessão do workspace mudou');
    expect(store.hasCachedDetail('user-a', 'search-1')).toBe(false);
    expect(store.visibleConversations()).toEqual([]);
  });

  it('bounds inactive detail cache while preserving the selected detail', async () => {
    const items = Array.from({ length: 22 }, (_, index) =>
      summary(`conversation-${index}`, 'account-a', 'SEARCH', `2026-09-11T10:${String(index).padStart(2, '0')}:00Z`));
    list.mockReturnValue(of(items));
    detail.mockImplementation((id) => of(conversation(id, 'account-a', 'SEARCH')));
    const workspaceIdentity = identity('account-a', 'SEARCH');
    await store.ensureConversationList('user-a');
    store.activate(workspaceIdentity, 'conversation-0');

    for (const item of items) await store.loadConversation(workspaceIdentity, item.id);

    expect(store.hasCachedDetail('user-a', 'conversation-0')).toBe(true);
    expect(store.hasCachedDetail('user-a', 'conversation-1')).toBe(false);
    expect(store.hasCachedDetail('user-a', 'conversation-21')).toBe(true);
  });

  function identity(platformAccountId: string, researchMode: 'SEARCH' | 'SURPRISE_ME') {
    return { userId: 'user-a', platformAccountId, researchMode } as const;
  }
});

function authenticated(userId: string): AuthSessionState {
  return {
    status: 'authenticated',
    user: {
      id: userId,
      name: 'User',
      email: `${userId}@example.com`,
      status: 'ACTIVE',
      createdAt: '2026-09-11T09:00:00Z',
      updatedAt: '2026-09-11T09:00:00Z',
    },
    message: null,
  };
}

function summary(
  id: string,
  platformAccountId: string,
  researchMode: 'SEARCH' | 'SURPRISE_ME',
  updatedAt: string,
): ReportConversationSummary {
  return {
    id,
    platformAccountId,
    platformCode: 'YOUTUBE',
    accountDisplayName: platformAccountId,
    accountHandle: null,
    title: id,
    latestReportTitle: null,
    latestReportGeneratedAt: null,
    status: 'ACTIVE',
    hasActiveRequest: false,
    createdAt: updatedAt,
    updatedAt,
    archivedAt: null,
    researchMode,
  };
}

function conversation(
  id: string,
  platformAccountId: string,
  researchMode: 'SEARCH' | 'SURPRISE_ME',
): ReportConversationDetail {
  return {
    conversation: summary(id, platformAccountId, researchMode, '2026-09-11T12:00:00Z'),
    entries: [],
    requests: [],
    reports: [],
  };
}
