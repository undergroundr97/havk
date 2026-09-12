import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api-config';
import {
  ReportConversationDetail,
  ReportConversationSummary,
  WorkspaceMessageRequest,
  WorkspaceMessageResponse,
} from './workspace.models';
import {
  parseConversationDetail,
  parseConversationList,
  parseWorkspaceMessageResponse,
} from './workspace.parser';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);

  list(): Observable<readonly ReportConversationSummary[]> {
    return this.http.get<unknown>(this.url).pipe(map(parseConversationList));
  }

  detail(conversationId: string): Observable<ReportConversationDetail> {
    return this.http.get<unknown>(`${this.url}/${encodeURIComponent(conversationId)}`)
      .pipe(map(parseConversationDetail));
  }

  archive(conversationId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(conversationId)}`)
      .pipe(map(() => undefined));
  }

  sendMessage(request: WorkspaceMessageRequest): Observable<WorkspaceMessageResponse> {
    return this.http.post<unknown>(`${this.api.baseUrl.replace(/\/$/, '')}/api/workspace/messages`, request)
      .pipe(map(parseWorkspaceMessageResponse));
  }

  private get url(): string {
    return `${this.api.baseUrl.replace(/\/$/, '')}/api/report-conversations`;
  }
}
