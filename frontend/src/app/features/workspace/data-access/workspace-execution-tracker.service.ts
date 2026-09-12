import { DestroyRef, effect, inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import {
  isFinalReportRequestStatus,
  ReportPollingEvent,
  ReportRequestResponse,
} from '../../report-generation/data-access/report-generation.models';
import { ReportGenerationService } from '../../report-generation/data-access/report-generation.service';
import { WorkspaceSessionStore, WorkspaceTrackingContext } from './workspace-session.store';

interface ActiveTracker {
  readonly context: WorkspaceTrackingContext;
  readonly subscription: Subscription;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceExecutionTracker {
  private readonly auth = inject(AuthSessionStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reportGeneration = inject(ReportGenerationService);
  private readonly sessions = inject(WorkspaceSessionStore);
  private readonly trackers = new Map<string, ActiveTracker>();
  private readonly terminalHydrations = new Set<string>();
  private observedUserId: string | null | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopAll());
    effect(() => {
      const state = this.auth.session();
      const userId = state.status === 'authenticated' ? state.user?.id ?? null : null;
      if (this.observedUserId !== undefined && this.observedUserId !== userId) this.stopAll();
      this.observedUserId = userId;
    });
  }

  ensure(requestId: string, context: WorkspaceTrackingContext): void {
    if (this.auth.user()?.id !== context.userId || this.trackers.has(requestId)) return;
    const owner = new Subscription();
    this.trackers.set(requestId, { context, subscription: owner });
    owner.add(this.reportGeneration.watchRequest(requestId).subscribe({
      next: (event) => this.handleEvent(requestId, context, event),
      complete: () => this.stop(requestId),
      error: () => this.sessions.setTrackingWarning(
        context,
        'O acompanhamento está temporariamente instável. A solicitação não foi reenviada.',
      ),
    }));
  }

  isTracking(requestId: string): boolean {
    return this.trackers.has(requestId);
  }

  activeCount(): number {
    return this.trackers.size;
  }

  stopAll(): void {
    for (const tracker of this.trackers.values()) tracker.subscription.unsubscribe();
    this.trackers.clear();
    this.terminalHydrations.clear();
  }

  private handleEvent(
    requestId: string,
    context: WorkspaceTrackingContext,
    event: ReportPollingEvent,
  ): void {
    if (event.kind === 'temporary-error') {
      this.sessions.setTrackingWarning(
        context,
        'O acompanhamento está temporariamente instável. A solicitação não foi reenviada.',
      );
      return;
    }
    this.sessions.applyTrackingUpdate(context, event.request);
    if (!isFinalReportRequestStatus(event.request.status)) return;
    if (this.sessions.needsTerminalHydration(context, event.request)) {
      this.hydrateTerminal(requestId, context, event.request);
    }
    this.stop(requestId);
  }

  private hydrateTerminal(
    requestId: string,
    context: WorkspaceTrackingContext,
    request: ReportRequestResponse,
  ): void {
    if (this.terminalHydrations.has(requestId)) return;
    this.terminalHydrations.add(requestId);
    void this.sessions.loadConversation(context, context.conversationId, true)
      .catch(() => {
        this.sessions.setTrackingWarning(
          context,
          request.status === 'COMPLETED'
            ? 'O relatório foi concluído, mas a atualização visual será recuperada ao reabrir a conversa.'
            : 'Não foi possível atualizar o resultado terminal agora.',
        );
      })
      .finally(() => this.terminalHydrations.delete(requestId));
  }

  private stop(requestId: string): void {
    const tracker = this.trackers.get(requestId);
    if (!tracker) return;
    this.trackers.delete(requestId);
    tracker.subscription.unsubscribe();
  }
}
