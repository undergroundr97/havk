import { isReportIdentifier, parseReportSummary } from '../../reports/data-access/report-response.parser';
import {
  DashboardActionType,
  DashboardActiveRequest,
  DashboardOnboarding,
  DashboardRecommendedAction,
  DashboardReports,
  DashboardResponse,
  DashboardProfileReview,
  DashboardYouTubeSummary,
  ChannelHealth,
  ChannelHealthInsight,
} from './dashboard.models';

const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export class InvalidDashboardResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDashboardResponseError';
  }
}

export function parseDashboardResponse(value: unknown): DashboardResponse {
  const dashboard = record(value, 'dashboard');
  const user = record(dashboard['user'], 'dashboard user');
  const platformAccount = parsePlatformAccount(dashboard['platformAccount']);
  const onboarding = parseOnboarding(dashboard['onboarding']);
  const reports = parseReports(dashboard['reports']);
  const recentReports = parseRecentReports(dashboard['recentReports']);
  const activeRequest = parseActiveRequest(dashboard['activeRequest']);
  const recommendedAction = parseRecommendedAction(dashboard['recommendedAction'], activeRequest);
  const youtube = parseYouTube(dashboard['youtube']);
  const channelHealth = parseChannelHealth(dashboard['channelHealth']);
  const profileReview = parseProfileReview(dashboard['profileReview']);

  if (onboarding.firstReportGenerated !== (reports.totalReports > 0)) {
    invalid('Dashboard report progress is inconsistent.');
  }
  if (reports.totalIdeas < reports.totalReports) {
    invalid('Dashboard idea totals are inconsistent.');
  }
  if ((reports.totalReports === 0) !== (reports.lastGeneratedAt === null)) {
    invalid('Dashboard last report date is inconsistent.');
  }
  if (recentReports && recentReports.length > Math.min(5, reports.totalReports)) {
    invalid('Dashboard recent reports exceed the summary total.');
  }

  return {
    user: { name: nullableNonEmptyString(user['name'], 'dashboard user name') },
    platformAccount,
    onboarding,
    reports,
    recentReports,
    activeRequest,
    recommendedAction,
    youtube,
    channelHealth,
    profileReview,
  };
}

function parsePlatformAccount(value: unknown) {
  if (value === null || value === undefined) return null;
  const account = record(value, 'dashboard platform account');
  return { id: uuid(account['id'], 'platform account id'),
    platformCode: nonEmptyString(account['platformCode'], 'platform code'),
    displayName: nonEmptyString(account['displayName'], 'platform account name'),
    handle: nullableNonEmptyString(account['handle'], 'platform account handle'),
    connectionStatus: nonEmptyString(account['connectionStatus'], 'connection status'),
    archived: boolean(account['archived'], 'platform account archived') };
}

function parseProfileReview(value: unknown): DashboardProfileReview | null {
  if (value === null || value === undefined) return null;
  const review = record(value, 'dashboard profile review');
  const status = review['status'];
  if (status !== 'INFERRED_PENDING_REVIEW' && status !== 'PARTIALLY_CONFIRMED'
      && status !== 'CONFIRMED' && status !== 'MANUAL' && status !== 'INSUFFICIENT_DATA') {
    invalid('Invalid profile review status.');
  }
  const confirmedRequiredFields = nonNegativeInteger(review['confirmedRequiredFields'], 'confirmedRequiredFields');
  const totalRequiredFields = nonNegativeInteger(review['totalRequiredFields'], 'totalRequiredFields');
  const remainingRequiredFields = nonNegativeInteger(review['remainingRequiredFields'], 'remainingRequiredFields');
  if (confirmedRequiredFields + remainingRequiredFields !== totalRequiredFields) {
    invalid('Profile review progress is inconsistent.');
  }
  const target = nonEmptyString(review['target'], 'profile review target');
  if (target !== '/perfil/revisao') invalid('Invalid profile review target.');
  return {
    status,
    confirmedRequiredFields,
    totalRequiredFields,
    remainingRequiredFields,
    hasNewSuggestions: boolean(review['hasNewSuggestions'], 'hasNewSuggestions'),
    target,
  };
}

function parseChannelHealth(value: unknown): ChannelHealth {
  const health = record(value, 'channel health');
  const status = health['status'];
  if (status !== 'SUCCESS' && status !== 'PARTIAL' && status !== 'EMPTY' && status !== 'ERROR'
      && status !== 'INTEGRATION_UNAVAILABLE') {
    invalid('Invalid channel health status.');
  }
  const source = health['source'];
  if (source !== null && source !== undefined && source !== 'SIMULATED' && source !== 'YOUTUBE') {
    invalid('Invalid channel health source.');
  }
  const simulated = boolean(health['simulated'], 'channel health simulated');
  if (simulated !== (source === 'SIMULATED')) invalid('Inconsistent channel health source.');
  const keys = [
    'publicationFrequency',
    'consistency',
    'highestEngagement',
    'peakRetention',
    'bestDay',
    'bestTime',
    'bestFormat',
  ] as const;
  const parsed = Object.fromEntries(keys.map((key) => [key, parseHealthInsight(health[key], key)])) as Record<
    (typeof keys)[number],
    ChannelHealthInsight | null
  >;
  const isTerminalEmpty = status === 'EMPTY' || status === 'ERROR';
  if (isTerminalEmpty !== keys.every((key) => parsed[key] === null)) {
    invalid('Channel health insights are inconsistent with its status.');
  }
  return {
    status,
    source: source ?? null,
    simulated,
    analyzedAt: nullableInstant(health['analyzedAt'], 'channel health analyzedAt'),
    ...parsed,
  };
}

function parseHealthInsight(value: unknown, label: string): ChannelHealthInsight | null {
  if (value === null || value === undefined) return null;
  const insight = record(value, `channel health ${label}`);
  const confidence = record(insight['confidence'], `channel health ${label} confidence`);
  const score = finiteNumber(confidence['score'], `${label} confidence score`);
  if (score < 0 || score > 1) invalid('Channel health confidence must be between 0 and 1.');
  const level = confidence['level'];
  if (level !== 'HIGH' && level !== 'MEDIUM' && level !== 'LOW' && level !== 'NONE') {
    invalid('Invalid channel health confidence level.');
  }
  const insufficientData = boolean(insight['insufficientData'], `${label} insufficientData`);
  const result: ChannelHealthInsight = {
    value: nullableNonEmptyString(insight['value'], `${label} value`),
    explanation: nonEmptyString(insight['explanation'], `${label} explanation`),
    criterion: nonEmptyString(insight['criterion'], `${label} criterion`),
    confidence: { score, level },
    insufficientData,
  };
  if (insufficientData !== (result.value === null) || insufficientData !== (score === 0)) {
    invalid('Channel health insufficient-data state is inconsistent.');
  }
  return result;
}

function parseYouTube(value:unknown):DashboardYouTubeSummary|null {
  if(value===null||value===undefined)return null;const summary=record(value,'dashboard YouTube summary');
  const source=summary['source'];if(source!==null&&source!==undefined&&source!=='SIMULATED'&&source!=='YOUTUBE')invalid('Invalid YouTube source.');
  const simulated=boolean(summary['simulated'],'YouTube simulated');if(simulated!==(source==='SIMULATED'))invalid('Inconsistent YouTube source.');
  return {connectionStatus:nonEmptyString(summary['connectionStatus'],'YouTube connection status'),synchronizationStatus:nullableNonEmptyString(summary['synchronizationStatus'],'YouTube synchronization status'),source:source??null,simulated,lastSynchronizedAt:nullableInstant(summary['lastSynchronizedAt'],'YouTube synchronization date'),subscriberCount:nullableCount(summary['subscriberCount'],'subscriberCount'),channelViewCount:nullableCount(summary['channelViewCount'],'channelViewCount'),channelVideoCount:nullableCount(summary['channelVideoCount'],'channelVideoCount'),periodViews:nullableCount(summary['periodViews'],'periodViews'),estimatedMinutesWatched:nullableCount(summary['estimatedMinutesWatched'],'estimatedMinutesWatched'),averageViewDurationSeconds:nullableCount(summary['averageViewDurationSeconds'],'averageViewDurationSeconds'),subscribersGained:nullableCount(summary['subscribersGained'],'subscribersGained'),subscribersLost:nullableCount(summary['subscribersLost'],'subscribersLost'),limitations:nullableNonEmptyString(summary['limitations'],'YouTube limitations'),failureCode:nullableNonEmptyString(summary['failureCode'],'YouTube failure code')};
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(`Invalid ${label}.`);
  return value;
}

function parseOnboarding(value: unknown): DashboardOnboarding {
  const onboarding = record(value, 'dashboard onboarding');
  const channelRegistered = boolean(onboarding['channelRegistered'], 'channelRegistered');
  const channelValue = onboarding['channel'];
  const channel = channelValue === null || channelValue === undefined
    ? null
    : (() => {
        const candidate = record(channelValue, 'dashboard channel');
        return {
          id: uuid(candidate['id'], 'dashboard channel id'),
          name: nonEmptyString(candidate['name'], 'dashboard channel name'),
        };
      })();
  if (channelRegistered !== (channel !== null)) invalid('Dashboard channel state is inconsistent.');

  return {
    accountCreated: boolean(onboarding['accountCreated'], 'accountCreated'),
    profileConfigured: boolean(onboarding['profileConfigured'], 'profileConfigured'),
    channelRegistered,
    firstReportGenerated: boolean(onboarding['firstReportGenerated'], 'firstReportGenerated'),
    channel,
  };
}

function parseReports(value: unknown): DashboardReports {
  const reports = record(value, 'dashboard reports');
  return {
    totalReports: nonNegativeInteger(reports['totalReports'], 'totalReports'),
    totalIdeas: nonNegativeInteger(reports['totalIdeas'], 'totalIdeas'),
    lastGeneratedAt: nullableInstant(reports['lastGeneratedAt'], 'lastGeneratedAt'),
  };
}

function parseRecentReports(value: unknown) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) invalid('Invalid recentReports.');
  const reports = value.map(parseReportSummary);
  if (reports.length > 5) invalid('Too many recentReports.');
  if (new Set(reports.map((report) => report.id)).size !== reports.length) {
    invalid('Duplicate recent report identifiers.');
  }
  for (let index = 1; index < reports.length; index += 1) {
    const previous = reports[index - 1];
    const current = reports[index];
    if (!previous || !current) invalid('Invalid recent report order.');
    const previousTime = Date.parse(previous.generatedAt);
    const currentTime = Date.parse(current.generatedAt);
    if (previousTime < currentTime || (previousTime === currentTime && previous.id < current.id)) {
      invalid('Recent reports are not ordered deterministically.');
    }
  }
  return reports;
}

function parseActiveRequest(value: unknown): DashboardActiveRequest | null {
  if (value === null || value === undefined) return null;
  const request = record(value, 'active request');
  const status = request['status'];
  if (
    status !== 'QUEUED' &&
    status !== 'DISCOVERING_CONTENT' &&
    status !== 'SELECTING_CONTENT' &&
    status !== 'ANALYZING_CONTENT' &&
    status !== 'FINDING_OPPORTUNITIES' &&
    status !== 'BUILDING_STRATEGY' &&
    status !== 'GENERATING_REPORT'
  ) {
    invalid('Invalid active request status.');
  }
  return {
    requestId: uuid(request['requestId'], 'active request id'),
    status,
    processingStep: nullableNonEmptyString(request['processingStep'], 'processingStep'),
    requestedTopic: nullableNonEmptyString(request['requestedTopic'], 'requestedTopic'),
    createdAt: instant(request['createdAt'], 'active request createdAt'),
    updatedAt: instant(request['updatedAt'], 'active request updatedAt'),
  };
}

function parseRecommendedAction(
  value: unknown,
  activeRequest: DashboardActiveRequest | null,
): DashboardRecommendedAction {
  const action = record(value, 'recommended action');
  const type = actionType(action['type']);
  const target = nonEmptyString(action['target'], 'recommended action target');
  const validTarget = expectedTargets(type, activeRequest).includes(target);
  if (!validTarget) invalid('Unsafe or inconsistent recommended action target.');
  return {
    type,
    title: nonEmptyString(action['title'], 'recommended action title'),
    description: nonEmptyString(action['description'], 'recommended action description'),
    target,
  };
}

function expectedTargets(
  type: DashboardActionType,
  activeRequest: DashboardActiveRequest | null,
): readonly string[] {
  switch (type) {
    case 'CONFIGURE_PROFILE':
      return ['/perfil', '/perfil/onboarding'];
    case 'REVIEW_PROFILE':
      return ['/perfil/revisao'];
    case 'CONFIGURE_CHANNEL':
      return ['/canal/novo', '/contas-de-plataforma'];
    case 'GENERATE_FIRST_REPORT':
    case 'GENERATE_REPORT':
      return ['/relatorios/novo'];
    case 'VIEW_REPORT_HISTORY':
      return ['/relatorios'];
    case 'FOLLOW_ACTIVE_REQUEST':
      return activeRequest
        ? [`/relatorios/novo?solicitacao=${activeRequest.requestId}`]
        : [];
  }
}

function actionType(value: unknown): DashboardActionType {
  switch (value) {
    case 'CONFIGURE_PROFILE':
    case 'REVIEW_PROFILE':
    case 'CONFIGURE_CHANNEL':
    case 'GENERATE_FIRST_REPORT':
    case 'FOLLOW_ACTIVE_REQUEST':
    case 'GENERATE_REPORT':
    case 'VIEW_REPORT_HISTORY':
      return value;
    default:
      invalid('Unknown recommended action.');
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    invalid(`Invalid ${label}.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) invalid(`Invalid ${label}.`);
  return value;
}

function nullableNonEmptyString(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  return nonEmptyString(value, label);
}

function uuid(value: unknown, label: string): string {
  const candidate = nonEmptyString(value, label);
  if (!isReportIdentifier(candidate)) invalid(`Invalid ${label}.`);
  return candidate;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') invalid(`Invalid ${label}.`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    invalid(`Invalid ${label}.`);
  }
  return value;
}

function nullableCount(value:unknown,label:string):number|null{if(value===null||value===undefined)return null;return nonNegativeInteger(value,label);}

function instant(value: unknown, label: string): string {
  const candidate = nonEmptyString(value, label);
  if (!ISO_INSTANT_PATTERN.test(candidate) || Number.isNaN(Date.parse(candidate))) {
    invalid(`Invalid ${label}.`);
  }
  return candidate;
}

function nullableInstant(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  return instant(value, label);
}

function invalid(message: string): never {
  throw new InvalidDashboardResponseError(message);
}
