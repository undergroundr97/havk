import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';

const NOW = '2026-09-11T12:00:00Z';
const ACCOUNT = '00000000-0000-4000-8000-000000000003';
const REPORT = '00000000-0000-4000-8000-000000000020';
const summary = { id: REPORT, requestId: '00000000-0000-4000-8000-000000000021',
  platformAccountId: ACCOUNT, platformCode: 'YOUTUBE', platformHandle: '@havkdemo', channelId: ACCOUNT,
  title: 'Relatório demonstrativo', summary: 'Uma direção editorial criada com dados locais.', generatedAt: NOW,
  createdAt: NOW, channelName: 'Canal HAVK Demo', requestedTopic: 'IA para criadores', requestedIdeaCount: 1,
  status: 'COMPLETED', simulated: true };
const emptyHealth = { status: 'EMPTY', source: null, simulated: false, analyzedAt: null, publicationFrequency: null,
  consistency: null, highestEngagement: null, peakRetention: null, bestDay: null, bestTime: null, bestFormat: null };

export const demoApiInterceptor: HttpInterceptorFn = (request, next) => {
  const path = new URL(request.url, 'http://demo.local').pathname;
  let body: unknown;
  if (path === '/api/auth/me') body = { id: '00000000-0000-4000-8000-000000000001', name: 'Visitante Demo',
    email: 'demo@havk.local', status: 'ACTIVE', createdAt: NOW, updatedAt: NOW };
  else if (path === '/api/auth/csrf') body = { headerName: 'X-XSRF-TOKEN', token: 'demo' };
  else if (path === '/api/auth/logout') body = null;
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
