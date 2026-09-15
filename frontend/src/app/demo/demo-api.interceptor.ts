import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

const NOW = '2026-09-11T12:00:00Z';
const ACCOUNT = '00000000-0000-4000-8000-000000000003';
const REPORT = '00000000-0000-4000-8000-000000000020';
const DEMO_SESSION_KEY = 'havk-demo-session';
const summary = { id: REPORT, requestId: '00000000-0000-4000-8000-000000000021',
  platformAccountId: ACCOUNT, platformCode: 'YOUTUBE', platformHandle: '@havkdemo', channelId: ACCOUNT,
  title: 'Relatório demonstrativo', summary: 'Uma direção editorial criada com dados locais.', generatedAt: NOW,
  createdAt: NOW, channelName: 'Canal HAVK Demo', requestedTopic: 'IA para criadores', requestedIdeaCount: 1,
  status: 'COMPLETED', simulated: true };
const emptyHealth = { status: 'EMPTY', source: null, simulated: false, analyzedAt: null, publicationFrequency: null,
  consistency: null, highestEngagement: null, peakRetention: null, bestDay: null, bestTime: null, bestFormat: null };

function demoUser(name: string, email: string) {
  return { id: '00000000-0000-4000-8000-000000000001', name, email, status: 'ACTIVE', createdAt: NOW, updatedAt: NOW };
}

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function isDemoAuthenticated(): boolean {
  return safeGet(DEMO_SESSION_KEY) === '1';
}

function setDemoSession(user: { name: string; email: string } | null): void {
  try {
    if (user) {
      sessionStorage.setItem(DEMO_SESSION_KEY, '1');
      sessionStorage.setItem(`${DEMO_SESSION_KEY}-name`, user.name);
      sessionStorage.setItem(`${DEMO_SESSION_KEY}-email`, user.email);
    } else {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
      sessionStorage.removeItem(`${DEMO_SESSION_KEY}-name`);
      sessionStorage.removeItem(`${DEMO_SESSION_KEY}-email`);
    }
  } catch {
    /* ignore storage errors (e.g. private browsing) */
  }
}

export const demoApiInterceptor: HttpInterceptorFn = (request, next) => {
  const path = new URL(request.url, 'http://demo.local').pathname;

  if (path === '/api/auth/me') {
    if (!isDemoAuthenticated()) {
      return throwError(() => new HttpErrorResponse({ status: 401, url: request.url }));
    }
    const name = safeGet(`${DEMO_SESSION_KEY}-name`) ?? 'Visitante Demo';
    const email = safeGet(`${DEMO_SESSION_KEY}-email`) ?? 'demo@havk.local';
    return of(new HttpResponse({ status: 200, body: demoUser(name, email), url: request.url }));
  }

  if (path === '/api/auth/login') {
    const requestBody = request.body as { email?: string } | null;
    const email = requestBody?.email?.trim() || 'demo@havk.local';
    setDemoSession({ name: 'Visitante Demo', email });
    return of(new HttpResponse({ status: 200, body: demoUser('Visitante Demo', email), url: request.url }));
  }

  if (path === '/api/auth/register') {
    const requestBody = request.body as { name?: string; email?: string } | null;
    const name = requestBody?.name?.trim() || 'Visitante Demo';
    const email = requestBody?.email?.trim() || 'demo@havk.local';
    return of(new HttpResponse({ status: 200, body: demoUser(name, email), url: request.url }));
  }

  if (path === '/api/auth/logout') {
    setDemoSession(null);
    return of(new HttpResponse({ status: 200, body: null, url: request.url }));
  }

  let body: unknown;
  if (path === '/api/auth/csrf') body = { headerName: 'X-XSRF-TOKEN', token: 'demo' };
  else if (path === '/api/reports') body = page([summary]);
  else if (path === '/api/dashboard') body = { user: { name: 'Visitante Demo' }, platformAccount: null,
    onboarding: { accountCreated: true, profileConfigured: true, channelRegistered: true, firstReportGenerated: true,
      channel: { id: ACCOUNT, name: 'Canal HAVK Demo' } }, reports: { totalReports: 1, totalIdeas: 1, lastGeneratedAt: NOW },
    recentReports: [summary], activeRequest: null, recommendedAction: { type: 'GENERATE_REPORT', title: 'Criar nova ideia',
      description: 'Explore o workspace demonstrativo.', target: '/workspace' }, youtube: null,
    channelHealth: emptyHealth, profileReview: null };
  else if (path === '/api/platforms' || path === '/api/platform-accounts' ||
      path === '/api/report-conversations' || path === '/api/trend-sources') body = [];
  else if (path === '/api/channel') body = { id: ACCOUNT, platform: 'YOUTUBE', name: 'Canal HAVK Demo',
    description: 'Canal demonstrativo.', url: 'https://www.youtube.com/@havkdemo', externalIdentifier: 'UC-DEMO',
    approximateSize: 18400, mainCategory: 'Tecnologia', language: 'pt-BR', dataOrigin: 'YOUTUBE_AUTHORIZED',
    createdAt: NOW, updatedAt: NOW };
  else return next(request);
  return of(new HttpResponse({ status: 200, body, url: request.url }));
};

function page(content: readonly unknown[]) {
  return { content, page: 0, size: 10, totalElements: content.length,
    totalPages: content.length ? 1 : 0, first: true, last: true };
}
