import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

import {
  isFinalReportRequestStatus,
  ReportPollingEvent,
  ReportRequestResponse,
  ReportRequestStatus,
} from './report-generation.models';

export interface ReportEventSource {
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export type ReportEventSourceFactory = (url: string) => ReportEventSource;

export const REPORT_EVENT_SOURCE_FACTORY = new InjectionToken<ReportEventSourceFactory>(
  'REPORT_EVENT_SOURCE_FACTORY',
  { providedIn: 'root', factory: () => (url) => new EventSource(url, { withCredentials: true }) },
);

export const REPORT_SSE_RECONNECT_MS = new InjectionToken<number>('REPORT_SSE_RECONNECT_MS', {
  providedIn: 'root',
  factory: () => 2_000,
});

interface ProductProgressEvent {
  readonly requestId: string;
  readonly sequence: number;
  readonly status: ReportRequestStatus;
  readonly progressPercent: number;
  readonly message: string;
  readonly occurredAt: string;
  readonly terminal: boolean;
  readonly resultAvailable: boolean;
}

@Injectable({ providedIn: 'root' })
export class ReportProgressService {
  private readonly eventSources = inject(REPORT_EVENT_SOURCE_FACTORY);
  private readonly reconnectMs = inject(REPORT_SSE_RECONNECT_MS);

  watch(requestId: string, eventsUrl: string,
    recover: () => Observable<ReportRequestResponse>): Observable<ReportPollingEvent> {
    return new Observable((subscriber) => {
      let source: ReportEventSource | null = null;
      let recovery: Subscription | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let current: ReportRequestResponse | null = null;
      let lastSequence = -1;
      let stopped = false;

      const closeSource = () => {
        source?.close();
        source = null;
      };
      const connect = () => {
        if (stopped || current === null || isFinalReportRequestStatus(current.status)) return;
        closeSource();
        source = this.eventSources(eventsUrl);
        source.onmessage = (message) => {
          try {
            const event = parseProgressEvent(message.data, requestId);
            if (current === null) return;
            if (event.sequence <= lastSequence) return;
            lastSequence = event.sequence;
            current = { ...current, status: event.status, progressPercent: event.progressPercent,
              progressMessage: event.message, updatedAt: event.occurredAt, terminal: event.terminal,
              resultAvailable: event.resultAvailable };
            if (event.terminal) {
              closeSource();
              recoverCurrent(false);
            } else {
              subscriber.next({ kind: 'update', request: current });
            }
          } catch (error: unknown) {
            subscriber.next({ kind: 'temporary-error', error });
          }
        };
        source.onerror = () => {
          closeSource();
          recoverCurrent(true);
        };
      };
      const recoverCurrent = (reconnect: boolean) => {
        if (stopped || recovery) return;
        recovery = recover().subscribe({
          next: (request) => {
            current = request;
            subscriber.next({ kind: 'update', request });
          },
          error: (error: unknown) => {
            recovery = null;
            subscriber.next({ kind: 'temporary-error', error });
            scheduleReconnect();
          },
          complete: () => {
            recovery = null;
            if (current && isFinalReportRequestStatus(current.status)) subscriber.complete();
            else if (reconnect) scheduleReconnect();
            else connect();
          },
        });
      };
      const scheduleReconnect = () => {
        if (stopped || reconnectTimer || current && isFinalReportRequestStatus(current.status)) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (current === null) recoverCurrent(false);
          else connect();
        }, this.reconnectMs);
      };

      recoverCurrent(false);
      return () => {
        stopped = true;
        closeSource();
        recovery?.unsubscribe();
        if (reconnectTimer) clearTimeout(reconnectTimer);
      };
    });
  }
}

function parseProgressEvent(payload: string, expectedRequestId: string): ProductProgressEvent {
  const value: unknown = JSON.parse(payload);
  if (!value || typeof value !== 'object') throw new Error('Invalid report progress event.');
  const event = value as Record<string, unknown>;
  if (event['requestId'] !== expectedRequestId || typeof event['sequence'] !== 'number'
      || !Number.isSafeInteger(event['sequence']) || !isStatus(event['status'])
      || typeof event['progressPercent'] !== 'number' || event['progressPercent'] < 0
      || event['progressPercent'] > 100 || typeof event['message'] !== 'string'
      || typeof event['occurredAt'] !== 'string' || typeof event['terminal'] !== 'boolean'
      || typeof event['resultAvailable'] !== 'boolean') {
    throw new Error('Invalid report progress event.');
  }
  return event as unknown as ProductProgressEvent;
}

function isStatus(value: unknown): value is ReportRequestStatus {
  return typeof value === 'string' && new Set<string>([
    'QUEUED', 'DISCOVERING_CONTENT', 'SELECTING_CONTENT', 'ANALYZING_CONTENT',
    'FINDING_OPPORTUNITIES', 'BUILDING_STRATEGY', 'GENERATING_REPORT',
    'COMPLETED', 'NO_RELEVANT_OPPORTUNITY', 'FAILED', 'CANCELLED',
  ]).has(value);
}
