import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { apiErrorMessage } from '../../../core/http/api-error-message';
import {
  isFinalReportRequestStatus,
  ReportRequestResponse,
} from '../../report-generation/data-access/report-generation.models';
import {
  ReportConversationDetail,
  ReportConversationSummary,
  ResearchMode,
} from './workspace.models';
import { WorkspaceService } from './workspace.service';

export interface WorkspaceSessionIdentity {
  readonly userId: string;
  readonly platformAccountId: string;
  readonly researchMode: ResearchMode;
}

export interface WorkspaceTrackingContext extends WorkspaceSessionIdentity {
  readonly conversationId: string;
}

interface WorkspaceModeSessionState extends WorkspaceSessionIdentity {
  readonly activeConversationId: string | null;
  readonly loadingConversationId: string | null;
  readonly error: string | null;
  readonly trackingWarning: string | null;
  readonly lastAccessedAt: number;
}

interface CachedConversationDetail {
  readonly userId: string;
  readonly detail: ReportConversationDetail;
  readonly lastAccessedAt: number;
}

const MAX_CACHED_CONVERSATION_DETAILS = 20;

@Injectable({ providedIn: 'root' })
export class WorkspaceSessionStore {
  private readonly auth = inject(AuthSessionStore);
  private readonly workspace = inject(WorkspaceService);
  private readonly sessions = signal<ReadonlyMap<string, WorkspaceModeSessionState>>(new Map());
  private readonly conversationsByUser = signal<ReadonlyMap<string, readonly ReportConversationSummary[]>>(new Map());
  private readonly details = signal<ReadonlyMap<string, CachedConversationDetail>>(new Map());
  private readonly activeIdentity = signal<WorkspaceSessionIdentity | null>(null);
  private readonly loadedUsers = new Set<string>();
  private readonly listInFlight = new Map<string, Promise<readonly ReportConversationSummary[]>>();
  private readonly detailInFlight = new Map<string, Promise<ReportConversationDetail>>();
  private generation = 0;
  private observedUserId: string | null | undefined;

  readonly activeResearchMode = computed<ResearchMode>(() => this.activeIdentity()?.researchMode ?? 'SEARCH');
  readonly activePlatformAccountId = computed(() => this.activeIdentity()?.platformAccountId ?? null);
  readonly visibleConversations = computed(() => {
    const identity = this.activeIdentity();
    if (!identity) return [];
    return (this.conversationsByUser().get(identity.userId) ?? []).filter((conversation) =>
      conversation.platformAccountId === identity.platformAccountId);
  });
  readonly selectedConversationId = computed(() => this.activeSession()?.activeConversationId ?? null);
  readonly detail = computed(() => {
    const identity = this.activeIdentity();
    const conversationId = this.selectedConversationId();
    if (!identity || !conversationId) return null;
    const cached = this.details().get(detailKey(identity.userId, conversationId));
    if (!cached || cached.userId !== identity.userId) return null;
    const conversation = cached.detail.conversation;
    if (conversation.platformAccountId !== identity.platformAccountId) return null;
    return cached.detail;
  });
  readonly conversationLoading = computed(() => {
    const session = this.activeSession();
    return session?.loadingConversationId !== null && session?.loadingConversationId !== undefined
      && this.detail() === null;
  });
  readonly conversationError = computed(() => this.activeSession()?.error ?? null);
  readonly trackingWarning = computed(() => this.activeSession()?.trackingWarning ?? null);

  constructor() {
    effect(() => {
      const state = this.auth.session();
      const userId = state.status === 'authenticated' ? state.user?.id ?? null : null;
      if (this.observedUserId !== undefined && this.observedUserId !== userId) this.purge();
      this.observedUserId = userId;
    });
  }

  activate(identity: WorkspaceSessionIdentity, conversationId?: string | null): void {
    if (!this.isCurrentUser(identity.userId)) return;
    const key = sessionKey(identity);
    const current = this.sessions().get(key);
    const next: WorkspaceModeSessionState = {
      ...identity,
      activeConversationId: conversationId === undefined ? current?.activeConversationId ?? null : conversationId,
      loadingConversationId: current?.loadingConversationId ?? null,
      error: current?.error ?? null,
      trackingWarning: current?.trackingWarning ?? null,
      lastAccessedAt: Date.now(),
    };
    this.updateSession(key, next);
    this.activeIdentity.set(identity);
  }

  clearActiveSelection(): void {
    const identity = this.activeIdentity();
    if (identity) this.activate(identity, null);
  }

  clearActiveFeedback(): void {
    this.patchActiveSession({ error: null, trackingWarning: null });
  }

  setInvalidConversation(message: string): void {
    this.patchActiveSession({ loadingConversationId: null, error: message });
  }

  async ensureConversationList(userId: string, force = false): Promise<readonly ReportConversationSummary[]> {
    if (!this.isCurrentUser(userId)) return [];
    if (!force && this.loadedUsers.has(userId)) return this.conversationsByUser().get(userId) ?? [];
    const existing = this.listInFlight.get(userId);
    if (existing) return existing;
    const requestGeneration = this.generation;
    const request = firstValueFrom(this.workspace.list()).then((items) => {
      if (requestGeneration !== this.generation || !this.isCurrentUser(userId)) return [];
      const normalized = normalizeConversationList(items);
      this.setConversationList(userId, normalized);
      this.loadedUsers.add(userId);
      return normalized;
    }).finally(() => {
      if (this.listInFlight.get(userId) === request) this.listInFlight.delete(userId);
    });
    this.listInFlight.set(userId, request);
    return request;
  }

  allConversations(userId: string): readonly ReportConversationSummary[] {
    return this.isCurrentUser(userId) ? this.conversationsByUser().get(userId) ?? [] : [];
  }

  isConversationListLoaded(userId: string): boolean {
    return this.isCurrentUser(userId) && this.loadedUsers.has(userId);
  }

  findConversation(userId: string, conversationId: string): ReportConversationSummary | null {
    return this.allConversations(userId).find((item) => item.id === conversationId) ?? null;
  }

  hasCachedDetail(userId: string, conversationId: string): boolean {
    return this.details().has(detailKey(userId, conversationId));
  }

  async loadConversation(
    identity: WorkspaceSessionIdentity,
    conversationId: string,
    force = false,
  ): Promise<ReportConversationDetail> {
    if (!this.isCurrentUser(identity.userId)) throw new Error('A sessão do workspace mudou.');
    const key = detailKey(identity.userId, conversationId);
    const cached = this.details().get(key);
    if (!force && cached) {
      this.touchDetail(key, cached);
      this.patchSession(identity, { loadingConversationId: null, error: null });
      return cached.detail;
    }
    const existing = this.detailInFlight.get(key);
    if (existing) return existing;
    this.patchSession(identity, {
      loadingConversationId: cached ? null : conversationId,
      error: null,
      trackingWarning: null,
    });
    const requestGeneration = this.generation;
    const request = firstValueFrom(this.workspace.detail(conversationId)).then((detail) => {
      if (requestGeneration !== this.generation || !this.isCurrentUser(identity.userId)) {
        throw new Error('A sessão do workspace mudou.');
      }
      if (detail.conversation.id !== conversationId) throw new Error('A conversa retornada não corresponde à URL.');
      this.cacheDetail(identity.userId, detail);
      this.upsertConversation(identity.userId, detail.conversation);
      this.patchSession(identity, { loadingConversationId: null, error: null, trackingWarning: null });
      return detail;
    }).catch((error: unknown) => {
      if (requestGeneration === this.generation && this.isCurrentUser(identity.userId)) {
        this.patchSession(identity, cached
          ? { loadingConversationId: null, error: null,
              trackingWarning: 'Não foi possível atualizar a conversa agora. O conteúdo carregado foi preservado.' }
          : { loadingConversationId: null,
              error: apiErrorMessage(error, 'Não foi possível carregar a conversa.') });
      }
      throw error;
    }).finally(() => {
      if (this.detailInFlight.get(key) === request) this.detailInFlight.delete(key);
    });
    this.detailInFlight.set(key, request);
    return request;
  }

  applyTrackingUpdate(context: WorkspaceTrackingContext, request: ReportRequestResponse): void {
    if (!this.isCurrentUser(context.userId)) return;
    const key = detailKey(context.userId, context.conversationId);
    const cached = this.details().get(key);
    if (cached) {
      const requests = cached.detail.requests.some((item) => item.requestId === request.requestId)
        ? cached.detail.requests.map((item) => item.requestId === request.requestId ? request : item)
        : [...cached.detail.requests, request];
      const detail: ReportConversationDetail = {
        ...cached.detail,
        conversation: {
          ...cached.detail.conversation,
          hasActiveRequest: requests.some((item) => !isFinalReportRequestStatus(item.status)),
        },
        requests,
      };
      this.cacheDetail(context.userId, detail);
      this.upsertConversation(context.userId, detail.conversation);
    }
    this.patchSession(context, { trackingWarning: null });
  }

  setTrackingWarning(context: WorkspaceTrackingContext, message: string): void {
    if (this.isCurrentUser(context.userId)) this.patchSession(context, { trackingWarning: message });
  }

  needsTerminalHydration(context: WorkspaceTrackingContext, request: ReportRequestResponse): boolean {
    if (request.status !== 'COMPLETED') return false;
    const cached = this.details().get(detailKey(context.userId, context.conversationId))?.detail;
    if (!cached) return true;
    if (request.reportId) return !cached.reports.some((report) => report.id === request.reportId);
    return request.resultAvailable !== false;
  }

  removeConversation(userId: string, conversationId: string): void {
    if (!this.isCurrentUser(userId)) return;
    this.setConversationList(userId, this.allConversations(userId).filter((item) => item.id !== conversationId));
    const details = new Map(this.details());
    details.delete(detailKey(userId, conversationId));
    this.details.set(details);
    const sessions = new Map(this.sessions());
    for (const [key, session] of sessions) {
      if (session.userId === userId && session.activeConversationId === conversationId) {
        sessions.set(key, { ...session, activeConversationId: null, loadingConversationId: null });
      }
    }
    this.sessions.set(sessions);
  }

  purge(): void {
    this.generation += 1;
    this.sessions.set(new Map());
    this.conversationsByUser.set(new Map());
    this.details.set(new Map());
    this.activeIdentity.set(null);
    this.loadedUsers.clear();
    this.listInFlight.clear();
    this.detailInFlight.clear();
  }

  private activeSession(): WorkspaceModeSessionState | null {
    const identity = this.activeIdentity();
    return identity ? this.sessions().get(sessionKey(identity)) ?? null : null;
  }

  private setConversationList(userId: string, items: readonly ReportConversationSummary[]): void {
    const conversations = new Map(this.conversationsByUser());
    conversations.set(userId, items);
    this.conversationsByUser.set(conversations);
    const sessions = new Map(this.sessions());
    for (const conversation of items) {
      const identity: WorkspaceSessionIdentity = {
        userId,
        platformAccountId: conversation.platformAccountId,
        researchMode: normalizeResearchMode(conversation.researchMode),
      };
      const key = sessionKey(identity);
      if (!sessions.has(key)) {
        sessions.set(key, {
          ...identity,
          activeConversationId: conversation.id,
          loadingConversationId: null,
          error: null,
          trackingWarning: null,
          lastAccessedAt: Date.now(),
        });
      }
    }
    this.sessions.set(sessions);
  }

  private upsertConversation(userId: string, conversation: ReportConversationSummary): void {
    this.setConversationList(userId, normalizeConversationList([
      ...this.allConversations(userId).filter((item) => item.id !== conversation.id),
      conversation,
    ]));
  }

  private cacheDetail(userId: string, detail: ReportConversationDetail): void {
    const key = detailKey(userId, detail.conversation.id);
    const details = new Map(this.details());
    details.delete(key);
    details.set(key, { userId, detail, lastAccessedAt: Date.now() });
    this.details.set(this.evictDetails(details));
  }

  private touchDetail(key: string, cached: CachedConversationDetail): void {
    const details = new Map(this.details());
    details.delete(key);
    details.set(key, { ...cached, lastAccessedAt: Date.now() });
    this.details.set(details);
  }

  private evictDetails(details: Map<string, CachedConversationDetail>): ReadonlyMap<string, CachedConversationDetail> {
    if (details.size <= MAX_CACHED_CONVERSATION_DETAILS) return details;
    const pinned = new Set<string>();
    for (const session of this.sessions().values()) {
      if (session.activeConversationId) pinned.add(detailKey(session.userId, session.activeConversationId));
    }
    for (const [key, cached] of details) {
      if (cached.detail.requests.some((request) => !isFinalReportRequestStatus(request.status))) pinned.add(key);
    }
    for (const key of details.keys()) {
      if (details.size <= MAX_CACHED_CONVERSATION_DETAILS) break;
      if (!pinned.has(key)) details.delete(key);
    }
    return details;
  }

  private patchActiveSession(patch: Partial<WorkspaceModeSessionState>): void {
    const identity = this.activeIdentity();
    if (identity) this.patchSession(identity, patch);
  }

  private patchSession(identity: WorkspaceSessionIdentity, patch: Partial<WorkspaceModeSessionState>): void {
    const key = sessionKey(identity);
    const current = this.sessions().get(key);
    if (!current) return;
    this.updateSession(key, { ...current, ...patch, lastAccessedAt: Date.now() });
  }

  private updateSession(key: string, session: WorkspaceModeSessionState): void {
    const sessions = new Map(this.sessions());
    sessions.set(key, session);
    this.sessions.set(sessions);
  }

  private isCurrentUser(userId: string): boolean {
    const state = this.auth.session();
    return state.status === 'authenticated' && state.user?.id === userId;
  }
}

export function normalizeResearchMode(mode: ResearchMode | null): ResearchMode {
  return mode ?? 'SEARCH';
}

function sessionKey(identity: WorkspaceSessionIdentity): string {
  return `${identity.userId}:${identity.platformAccountId}`;
}

function detailKey(userId: string, conversationId: string): string {
  return `${userId}:${conversationId}`;
}

function normalizeConversationList(items: readonly ReportConversationSummary[]): readonly ReportConversationSummary[] {
  const unique = new Map<string, ReportConversationSummary>();
  for (const conversation of items) {
    const current = unique.get(conversation.id);
    if (!current || Date.parse(conversation.updatedAt) >= Date.parse(current.updatedAt)) {
      unique.set(conversation.id, conversation);
    }
  }
  return [...unique.values()].sort((left, right) =>
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || right.id.localeCompare(left.id));
}
