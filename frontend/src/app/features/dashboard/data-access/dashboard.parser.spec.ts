import { parseDashboardResponse } from './dashboard.parser';

describe('dashboard parser', () => {
  it('accepts the complete typed contract and preserves backend order', () => {
    const parsed = parseDashboardResponse(response());

    expect(parsed.user.name).toBe('Criadora HAVK');
    expect(parsed.recentReports?.map((report) => report.title)).toEqual([
      'Relatório mais recente',
      'Relatório anterior',
    ]);
    expect(parsed.recommendedAction.type).toBe('GENERATE_REPORT');
  });

  it('allows only the documented partial state for unavailable recent reports', () => {
    const parsed = parseDashboardResponse({ ...response(), recentReports: null });

    expect(parsed.recentReports).toBeNull();
    expect(parsed.reports.totalReports).toBe(2);
  });

  it('parses YouTube metrics and keeps simulated provenance visible',()=>{
    const parsed=parseDashboardResponse({...response(),youtube:{connectionStatus:'CONNECTED',synchronizationStatus:'COMPLETED',source:'SIMULATED',simulated:true,lastSynchronizedAt:'2026-07-28T12:00:00Z',subscriberCount:12345,channelViewCount:987654,channelVideoCount:3,periodViews:134700,estimatedMinutesWatched:1122500,averageViewDurationSeconds:500,subscribersGained:1240,subscribersLost:180,limitations:null,failureCode:null}});
    expect(parsed.youtube?.simulated).toBe(true);expect(parsed.youtube?.periodViews).toBe(134700);
  });

  it('parses channel health with historical estimates and explicit confidence', () => {
    const parsed = parseDashboardResponse({ ...response(), channelHealth: health() });
    expect(parsed.channelHealth.simulated).toBe(true);
    expect(parsed.channelHealth.bestDay?.value).toBe('Quarta-feira');
    expect(parsed.channelHealth.bestDay?.confidence.level).toBe('LOW');
  });

  it.each([
    ['unknown action', { ...response(), recommendedAction: { ...response().recommendedAction, type: 'CONNECT_YOUTUBE' } }],
    ['unsafe target', { ...response(), recommendedAction: { ...response().recommendedAction, target: '//evil.example' } }],
    ['invalid date', { ...response(), reports: { ...response().reports, lastGeneratedAt: 'yesterday' } }],
    ['inconsistent channel', { ...response(), onboarding: { ...response().onboarding, channelRegistered: false } }],
    ['unordered reports', { ...response(), recentReports: [...response().recentReports].reverse() }],
    ['invalid health confidence', { ...response(), channelHealth: { ...health(), bestDay: { ...insight('Quarta-feira'), confidence: { score: 2, level: 'HIGH' } } } }],
  ])('rejects %s instead of producing partial success', (_label, payload) => {
    expect(() => parseDashboardResponse(payload)).toThrow();
  });

  it('accepts an active request only with its matching internal follow target', () => {
    const requestId = '00000000-0000-4000-8000-000000000031';
    const parsed = parseDashboardResponse({
      ...response(),
      activeRequest: {
        requestId,
        status: 'GENERATING_REPORT',
        processingStep: 'GENERATING_REPORT',
        requestedTopic: 'Angular',
        createdAt: '2026-07-22T12:06:00Z',
        updatedAt: '2026-07-22T12:07:00Z',
      },
      recommendedAction: {
        type: 'FOLLOW_ACTIVE_REQUEST',
        title: 'Acompanhe seu conteúdo',
        description: 'O processamento continua em segundo plano.',
        target: `/relatorios/novo?solicitacao=${requestId}`,
      },
    });

    expect(parsed.activeRequest?.status).toBe('GENERATING_REPORT');
  });
});

function response() {
  return {
    user: { name: 'Criadora HAVK' },
    onboarding: {
      accountCreated: true,
      profileConfigured: true,
      channelRegistered: true,
      firstReportGenerated: true,
      channel: { id: '00000000-0000-4000-8000-000000000003', name: 'Canal HAVK' },
    },
    reports: {
      totalReports: 2,
      totalIdeas: 5,
      lastGeneratedAt: '2026-07-22T12:05:00Z',
    },
    recentReports: [
      report('00000000-0000-4000-8000-000000000020', 'Relatório mais recente'),
      report('00000000-0000-4000-8000-000000000010', 'Relatório anterior'),
    ],
    activeRequest: null,
    recommendedAction: {
      type: 'GENERATE_REPORT',
      title: 'Pronto para uma nova ideia?',
      description: 'Gere novas oportunidades.',
      target: '/relatorios/novo',
    },
    youtube: null,
    channelHealth: emptyHealth(),
  };
}
function health() {
  return {
    status: 'SUCCESS', source: 'SIMULATED', simulated: true, analyzedAt: '2026-07-28T12:00:00Z',
    publicationFrequency: insight('1 vídeo por semana'), consistency: insight('Consistência excelente'),
    highestEngagement: insight('Rotina sustentável'), peakRetention: insight('78%'),
    bestDay: insight('Quarta-feira', .48, 'LOW'), bestTime: insight('09h–11h', .48, 'LOW'),
    bestFormat: insight('Vídeos longos'),
  };
}

function insight(value: string, score = .75, level = 'MEDIUM') {
  return { value, explanation: 'Estimativa histórica; não é garantia.', criterion: 'Critério transparente', confidence: { score, level }, insufficientData: false };
}

function emptyHealth() {
  return { status: 'EMPTY', source: null, simulated: false, analyzedAt: null, publicationFrequency: null,
    consistency: null, highestEngagement: null, peakRetention: null, bestDay: null, bestTime: null, bestFormat: null };
}

function report(id: string, title: string) {
  return {
    id,
    requestId: id.replace(/.$/, '1'),
    channelId: '00000000-0000-4000-8000-000000000003',
    title,
    summary: 'Resumo seguro.',
    generatedAt: '2026-07-22T12:05:00Z',
    createdAt: '2026-07-22T12:05:01Z',
    channelName: 'Canal HAVK',
    requestedTopic: null,
    requestedIdeaCount: 3,
    status: 'COMPLETED',
  };
}
