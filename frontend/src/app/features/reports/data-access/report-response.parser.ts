import {
  PageResponse,
  FormatDecisionResponse,
  ReportEvidenceResponse,
  ReportDetailResponse,
  ReportFinalStatus,
  ReportSourceResponse,
  ReportSummaryResponse,
  VideoIdeaResponse,
} from './report.models';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export class InvalidReportResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReportResponseError';
  }
}

export function parseReportPage(value: unknown): PageResponse<ReportSummaryResponse> {
  const page = record(value, 'report page');
  const content = array(page, 'content').map((item) => parseReportSummary(item));
  const pageNumber = nonNegativeInteger(page, 'page');
  const size = positiveInteger(page, 'size');
  const totalElements = nonNegativeInteger(page, 'totalElements');
  const totalPages = nonNegativeInteger(page, 'totalPages');
  const first = boolean(page, 'first');
  const last = boolean(page, 'last');

  if (content.length > size) invalid('Report page content exceeds its declared size.');
  if (new Set(content.map((item) => item.id)).size !== content.length) {
    invalid('Report page contains duplicate report identifiers.');
  }
  if (totalPages !== (totalElements === 0 ? 0 : Math.ceil(totalElements / size))) {
    invalid('Report page totals are inconsistent.');
  }
  if (first !== (pageNumber === 0)) invalid('Report page first flag is inconsistent.');
  if (last !== (totalPages === 0 || pageNumber + 1 >= totalPages)) {
    invalid('Report page last flag is inconsistent.');
  }
  if (content.length > 0 && (totalElements === 0 || pageNumber * size >= totalElements)) {
    invalid('Report page content is outside the declared total.');
  }

  return {
    content,
    page: pageNumber,
    size,
    totalElements,
    totalPages,
    first,
    last,
  };
}

export function parseReportDetail(value: unknown): ReportDetailResponse {
  const detail = record(value, 'report detail');
  const ideas = array(detail, 'ideas').map((item) => parseVideoIdea(item));
  ensureUnique(ideas.map((idea) => idea.id), 'Report detail contains duplicate idea identifiers.');
  ensureUnique(ideas.map((idea) => idea.position), 'Report detail contains duplicate idea positions.');

  const sources = array(detail, 'sources').map((item) => parseReportSource(item));
  ensureUnique(
    sources.map((source) => source.id),
    'Report detail contains duplicate source identifiers.',
  );
  ensureUnique(
    sources.map((source) => source.position),
    'Report detail contains duplicate source positions.',
  );

  const ideaIds = new Set(ideas.map((idea) => idea.id));
  if (sources.some((source) => source.videoIdeaId !== null && !ideaIds.has(source.videoIdeaId))) {
    invalid('Report source references an unknown idea.');
  }

  const sections = optionalArray(detail, 'sections').map(parseReportSection);
  const scriptContractVersion = nullableNonEmptyString(detail, 'scriptContractVersion');
  const formatDecision = parseFormatDecision(detail['formatDecision']);
  const totalDuration = nullablePositiveInteger(detail, 'totalEstimatedDurationSeconds');
  if (scriptContractVersion === 'report-contract-v3') {
    validateV3Report(sections, formatDecision, totalDuration);
  }

  return {
    id: uuid(detail, 'id'),
    requestId: uuid(detail, 'requestId'),
    conversationId: optionalUuid(detail, 'conversationId'),
    platformAccountId: optionalAccountId(detail),
    platformCode: optionalPlatformCode(detail),
    platformHandle: nullableNonEmptyString(detail, 'platformHandle'),
    channelId: nullableUuid(detail, 'channelId'),
    channelName: nonEmptyString(detail, 'channelName'),
    requestedTopic: nullableNonEmptyString(detail, 'requestedTopic'),
    objective: optionalNonEmptyString(detail, 'objective', 'Objetivo não informado na versão legada.'),
    title: nonEmptyString(detail, 'title'),
    summary: nonEmptyString(detail, 'summary'),
    methodology: optionalNonEmptyString(detail, 'methodology', 'HOOK_PROBLEM_SOLUTION_DIFFERENTIATOR'),
    generationMode: optionalNonEmptyString(detail, 'generationMode', 'USER_DIRECTED'),
    simulated: optionalBoolean(detail, 'simulated', true),
    providerVersion: optionalNonEmptyString(detail, 'providerVersion', 'legacy-fake-v1'),
    provider: optionalNonEmptyString(detail, 'provider', 'fake'),
    model: optionalNonEmptyString(detail, 'model', 'fake-report-generation'),
    reportVersion: optionalPositiveInteger(detail, 'reportVersion', 1),
    regeneratedFromReportId: nullableUuid(detail, 'regeneratedFromReportId'),
    lineageRootReportId: optionalUuid(detail, 'lineageRootReportId'),
    contextSufficiency: optionalNonEmptyString(detail, 'contextSufficiency', 'LIMITED'),
    contextConfidence: optionalNumber(detail, 'contextConfidence', 0),
    primaryNiche: nullableNonEmptyString(detail, 'primaryNiche'),
    targetAudience: nullableNonEmptyString(detail, 'targetAudience'),
    language: nullableNonEmptyString(detail, 'language'),
    region: nullableNonEmptyString(detail, 'region'),
    recommendedFormat: nullableNonEmptyString(detail, 'recommendedFormat'),
    formatRecommendationReason: optionalNonEmptyString(detail, 'formatRecommendationReason', 'Dados insuficientes para recomendar um formato.'),
    formatDecision,
    totalEstimatedDurationSeconds: totalDuration,
    totalEstimatedDurationLabel: nullableNonEmptyString(detail, 'totalEstimatedDurationLabel'),
    estimatedWordCount: nullablePositiveInteger(detail, 'estimatedWordCount'),
    speakingRateWordsPerMinute: nullablePositiveInteger(detail, 'speakingRateWordsPerMinute'),
    scriptContractVersion,
    schemaVersion: nullableNonEmptyString(detail, 'schemaVersion'),
    promptVersion: nullableNonEmptyString(detail, 'promptVersion'),
    evidenceSummary: optionalArray(detail, 'evidenceSummary').map(parseEvidence),
    generationNotice: optionalNonEmptyString(detail, 'generationNotice', 'Conteúdo demonstrativo.'),
    dataCollectedAt: nullableInstant(detail, 'dataCollectedAt'),
    generatedAt: instant(detail, 'generatedAt'),
    createdAt: instant(detail, 'createdAt'),
    ideas,
    sources,
    sections,
    trends: optionalArray(detail, 'trends').map(parseReportTrend),
    generationContext: parseGenerationContext(detail['generationContext']),
  };
}

export function isReportIdentifier(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function parseReportSummary(value: unknown): ReportSummaryResponse {
  const summary = record(value, 'report summary');
  return {
    id: uuid(summary, 'id'),
    requestId: uuid(summary, 'requestId'),
    conversationId: optionalUuid(summary, 'conversationId'),
    platformAccountId: optionalAccountId(summary),
    platformCode: optionalPlatformCode(summary),
    platformHandle: nullableNonEmptyString(summary, 'platformHandle'),
    channelId: nullableUuid(summary, 'channelId'),
    title: nonEmptyString(summary, 'title'),
    summary: nonEmptyString(summary, 'summary'),
    generatedAt: instant(summary, 'generatedAt'),
    createdAt: instant(summary, 'createdAt'),
    channelName: nonEmptyString(summary, 'channelName'),
    requestedTopic: nullableNonEmptyString(summary, 'requestedTopic'),
    requestedIdeaCount: ideaCount(summary, 'requestedIdeaCount'),
    methodology: optionalNonEmptyString(summary, 'methodology', 'HOOK_PROBLEM_SOLUTION_DIFFERENTIATOR'),
    generationMode: optionalNonEmptyString(summary, 'generationMode', 'USER_DIRECTED'),
    reportVersion: optionalPositiveInteger(summary, 'reportVersion', 1),
    simulated: optionalBoolean(summary, 'simulated', true),
    status: finalStatus(summary['status']),
  };
}

function parseVideoIdea(value: unknown): VideoIdeaResponse {
  const idea = record(value, 'video idea');
  return {
    id: uuid(idea, 'id'),
    position: nonNegativeInteger(idea, 'position'),
    provisionalTitle: nonEmptyString(idea, 'provisionalTitle'),
    summary: nonEmptyString(idea, 'summary'),
    relatedTrend: nonEmptyString(idea, 'relatedTrend'),
    compatibilityJustification: nonEmptyString(idea, 'compatibilityJustification'),
    hook: nonEmptyString(idea, 'hook'),
    problem: nonEmptyString(idea, 'problem'),
    solution: nonEmptyString(idea, 'solution'),
    differentiator: nonEmptyString(idea, 'differentiator'),
    targetAudience: nonEmptyString(idea, 'targetAudience'),
    notes: nonEmptyString(idea, 'notes'),
    relevanceLevel: nullableNonEmptyString(idea, 'relevanceLevel'),
    competitionLevel: nullableNonEmptyString(idea, 'competitionLevel'),
    urgencyLevel: nullableNonEmptyString(idea, 'urgencyLevel'),
    keywords: stringArray(idea, 'keywords'),
    risks: stringArray(idea, 'risks'),
    limitations: stringArray(idea, 'limitations'),
    opportunities: optionalArray(idea, 'opportunities').map((value) => {
      const link = record(value, 'idea opportunity link');
      const relationType = nonEmptyString(link, 'relationType');
      if (relationType !== 'PRIMARY' && relationType !== 'SUPPORTING') invalid('Invalid opportunity relation.');
      return { opportunityContextId: uuid(link, 'opportunityContextId'),
        displayTopic: nonEmptyString(link, 'displayTopic'), relationType, position: positiveInteger(link, 'position') };
    }),
  };
}

function parseGenerationContext(value: unknown) {
  if (value === null || value === undefined) return null;
  const context = record(value, 'generation context');
  const generationStrategy = nonEmptyString(context, 'generationStrategy');
  const sourceMode = nonEmptyString(context, 'sourceMode');
  if (generationStrategy !== 'SURPRISE_ME' && generationStrategy !== 'TOPIC_GUIDED') {
    invalid('Invalid generation strategy.');
  }
  if (!['YOUTUBE_NICHE_RANKING', 'YOUTUBE_NICHE_RANKING_WITH_TOPIC',
    'PROFILE_AND_CHANNEL_CONTEXT', 'PROFILE_CONTEXT'].includes(sourceMode)) invalid('Invalid source mode.');
  return {
    generationStrategy: generationStrategy as 'SURPRISE_ME' | 'TOPIC_GUIDED',
    sourceMode: sourceMode as 'YOUTUBE_NICHE_RANKING' | 'YOUTUBE_NICHE_RANKING_WITH_TOPIC'
      | 'PROFILE_AND_CHANNEL_CONTEXT' | 'PROFILE_CONTEXT',
    capturedAt: instant(context, 'capturedAt'), effectiveIdeaCount: positiveInteger(context, 'effectiveIdeaCount'),
    contextSummary: nonEmptyString(context, 'contextSummary'), limitations: nonEmptyString(context, 'limitations'),
    opportunities: array(context, 'opportunities').map((value) => {
      const opportunity = record(value, 'opportunity context');
      return { contextId: uuid(opportunity, 'contextId'), collectionRunId: uuid(opportunity, 'collectionRunId'),
        rankingRunId: uuid(opportunity, 'rankingRunId'), opportunityId: uuid(opportunity, 'opportunityId'),
        selectionPosition: positiveInteger(opportunity, 'selectionPosition'),
        rankingPosition: positiveInteger(opportunity, 'rankingPosition'),
        displayTopic: nonEmptyString(opportunity, 'displayTopic'),
        rankingScore: boundedNumber(opportunity, 'rankingScore'), confidence: nonEmptyString(opportunity, 'confidence'),
        selectionScore: boundedNumber(opportunity, 'selectionScore'),
        selectionReasons: nonEmptyString(opportunity, 'selectionReasons'),
        explanation: nonEmptyString(opportunity, 'explanation'), algorithmVersion: nonEmptyString(opportunity, 'algorithmVersion'),
        observedAt: instant(opportunity, 'observedAt'), evidences: array(opportunity, 'evidences').map((value) => {
          const evidence = record(value, 'opportunity evidence');
          return { position: positiveInteger(evidence, 'position'), externalVideoId: nonEmptyString(evidence, 'externalVideoId'),
            title: nonEmptyString(evidence, 'title'), publicUrl: youtubeUrl(evidence, 'publicUrl'),
            publicChannelName: nullableNonEmptyString(evidence, 'publicChannelName'), publishedAt: instant(evidence, 'publishedAt'),
            publicMetrics: numericRecord(evidence['publicMetrics']) };
        }) };
    }),
  };
}

function boundedNumber(value: Record<string, unknown>, key: string): number {
  const result = optionalNumber(value, key, -1);
  if (result < 0 || result > 1) invalid(`Invalid ${key}.`);
  return result;
}

function youtubeUrl(value: Record<string, unknown>, key: string): string {
  const result = nonEmptyString(value, key);
  if (!result.startsWith('https://www.youtube.com/watch?v=')) invalid(`Invalid ${key}.`);
  return result;
}

function numericRecord(value: unknown): Readonly<Record<string, number>> {
  const result = record(value, 'public metrics');
  if (Object.values(result).some((item) => typeof item !== 'number' || !Number.isFinite(item) || item < 0)) {
    invalid('Invalid public metrics.');
  }
  return result as Record<string, number>;
}

function parseReportSource(value: unknown): ReportSourceResponse {
  const source = record(value, 'report source');
  return {
    id: uuid(source, 'id'),
    videoIdeaId: nullableUuid(source, 'videoIdeaId'),
    position: nonNegativeInteger(source, 'position'),
    sourceType: nonEmptyString(source, 'sourceType'),
    sourceName: nonEmptyString(source, 'sourceName'),
    title: nonEmptyString(source, 'title'),
    reference: nonEmptyString(source, 'reference'),
    publisher: nullableNonEmptyString(source, 'publisher'),
    publishedAt: nullableInstant(source, 'publishedAt'),
    collectedAt: instant(source, 'collectedAt'),
    trendResultId: nullableUuid(source, 'trendResultId'),
    sourceReliability: nullableNonEmptyString(source, 'sourceReliability'),
    evidence: optionalStringArray(source, 'evidence'),
    attributionType: optionalNonEmptyString(source, 'attributionType', 'SOURCE_FACT'),
  };
}

function parseReportSection(value: unknown) {
  const section = record(value, 'report section');
  return {
    key: nonEmptyString(section, 'key'), content: nonEmptyString(section, 'content'),
    purpose: nullableNonEmptyString(section, 'purpose'), reasoning: nullableNonEmptyString(section, 'reasoning'),
    impact: nullableNonEmptyString(section, 'impact'), context: nullableNonEmptyString(section, 'context'),
    consequence: nullableNonEmptyString(section, 'consequence'), relationship: nullableNonEmptyString(section, 'relationship'),
    expectedOutcome: nullableNonEmptyString(section, 'expectedOutcome'), variations: optionalStringArray(section, 'variations'),
    keyPoints: optionalStringArray(section, 'keyPoints'), evidence: optionalStringArray(section, 'evidence'),
    spokenScript: nullableNonEmptyString(section, 'spokenScript'),
    transitionToNextSection: nullableNonEmptyString(section, 'transitionToNextSection'),
    modelEstimatedSeconds: nullablePositiveInteger(section, 'modelEstimatedSeconds'),
    calculatedSpeechSeconds: nullablePositiveInteger(section, 'calculatedSpeechSeconds'),
    estimatedSpeechSeconds: nullablePositiveInteger(section, 'estimatedSpeechSeconds'),
    estimatedSpeechLabel: nullableNonEmptyString(section, 'estimatedSpeechLabel'),
    startSecond: nullableNonNegativeInteger(section, 'startSecond'),
    endSecond: nullablePositiveInteger(section, 'endSecond'),
    deliveryNotes: nullableNonEmptyString(section, 'deliveryNotes'),
    structuredEvidence: optionalArray(section, 'structuredEvidence').map(parseEvidence),
  };
}

function parseFormatDecision(value: unknown): FormatDecisionResponse | null {
  if (value === null || value === undefined) return null;
  const decision = record(value, 'format decision');
  const format = nonEmptyString(decision, 'format');
  if (!['SHORT_FORM', 'STANDARD_VIDEO', 'LONG_FORM', 'LIVE', 'OTHER'].includes(format)) {
    invalid('Invalid recommended format.');
  }
  const confidence = optionalNumber(decision, 'confidence', -1);
  if (confidence < 0 || confidence > 1) invalid('Invalid format confidence.');
  const historicalAffinity = nullableBoundedNumber(decision, 'historicalAffinity');
  const historicalEvidenceCount = optionalNonNegativeInteger(decision, 'historicalEvidenceCount', 0);
  if ((historicalAffinity === null) !== (historicalEvidenceCount === 0)) {
    invalid('Inconsistent historical format evidence.');
  }
  const alternatives = optionalArray(decision, 'alternatives').map(parseFormatOption);
  ensureUnique(alternatives.map((option) => option.format), 'Duplicate alternative format.');
  if (alternatives.some((option) => option.format === format)) {
    invalid('Recommended format cannot also be an alternative.');
  }
  return {
    format: format as FormatDecisionResponse['format'],
    reason: nonEmptyString(decision, 'reason'),
    confidence,
    metricsUsed: optionalStringArray(decision, 'metricsUsed'),
    limitations: optionalStringArray(decision, 'limitations'),
    targetDurationSeconds: positiveInteger(decision, 'targetDurationSeconds'),
    historicalAffinity,
    historicalEvidenceCount,
    alternatives,
  };
}

function parseFormatOption(value: unknown) {
  const option = record(value, 'content format option');
  const format = nonEmptyString(option, 'format');
  if (!['SHORT_FORM', 'STANDARD_VIDEO', 'LONG_FORM', 'LIVE', 'OTHER'].includes(format)) {
    invalid('Invalid alternative format.');
  }
  return {
    format: format as FormatDecisionResponse['format'],
    historicalAffinity: boundedNumber(option, 'historicalAffinity'),
    confidence: boundedNumber(option, 'confidence'),
    evidenceCount: positiveInteger(option, 'evidenceCount'),
    recentUsagePenalty: boundedNumber(option, 'recentUsagePenalty'),
  };
}

function parseEvidence(value: unknown): ReportEvidenceResponse {
  const evidence = record(value, 'report evidence');
  const type = nonEmptyString(evidence, 'type');
  if (!['SOURCE_FACT', 'CONTENT_HISTORY_FACT', 'ACCOUNT_METRIC', 'HAVK_CALCULATION', 'HAVK_RECOMMENDATION'].includes(type)) {
    invalid('Invalid evidence type.');
  }
  return {
    type: type as ReportEvidenceResponse['type'],
    claim: nonEmptyString(evidence, 'claim'),
    contentItemId: nullableUuid(evidence, 'contentItemId'),
    metricSnapshotId: nullableUuid(evidence, 'metricSnapshotId'),
    sourceId: nullableUuid(evidence, 'sourceId'),
  };
}

function validateV3Report(
  sections: readonly ReturnType<typeof parseReportSection>[],
  decision: FormatDecisionResponse | null,
  totalDuration: number | null,
): void {
  if (!decision || totalDuration === null) invalid('Incomplete report-contract-v3 metadata.');
  if (sections.length === 0 || new Set(sections.map((section) => section.key)).size !== sections.length) {
    invalid('Invalid report-contract-v3 sections.');
  }
  let cursor = 0;
  for (const [index, section] of sections.entries()) {
    if (!section.spokenScript || section.estimatedSpeechSeconds === null
        || section.estimatedSpeechSeconds === undefined || section.startSecond !== cursor
        || section.endSecond !== cursor + section.estimatedSpeechSeconds) {
      invalid('Invalid report-contract-v3 timeline.');
    }
    if (index < sections.length - 1 && !section.transitionToNextSection) invalid('Missing spoken transition.');
    if (index === sections.length - 1 && section.transitionToNextSection !== null) {
      invalid('Unexpected final transition.');
    }
    cursor = section.endSecond;
  }
  if (cursor !== totalDuration) invalid('Inconsistent report-contract-v3 total duration.');
}

function parseReportTrend(value: unknown) {
  const trend = record(value, 'report trend');
  return {
    trendResultId: uuid(trend, 'trendResultId'), title: nonEmptyString(trend, 'title'),
    factualSummary: nonEmptyString(trend, 'factualSummary'), originalUrl: nonEmptyString(trend, 'originalUrl'),
    sourceName: nonEmptyString(trend, 'sourceName'), sourceType: nonEmptyString(trend, 'sourceType'),
    sourceReliability: nonEmptyString(trend, 'sourceReliability'), authorOrInstitution: nullableNonEmptyString(trend, 'authorOrInstitution'),
    publishedAt: nullableInstant(trend, 'publishedAt'), collectedAt: instant(trend, 'collectedAt'),
    evidence: optionalStringArray(trend, 'evidence'), relevanceReason: nonEmptyString(trend, 'relevanceReason'),
    relevance: optionalNumber(trend, 'relevance', 0), rankingConfidence: optionalNumber(trend, 'rankingConfidence', 0),
    freshnessStatus: nonEmptyString(trend, 'freshnessStatus'), realData: optionalBoolean(trend, 'realData', false),
  };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) invalid(`Invalid ${label}.`);
  return value;
}

function array(value: Record<string, unknown>, key: string): readonly unknown[] {
  const candidate = value[key];
  if (!isUnknownArray(candidate)) invalid(`Invalid ${key}.`);
  return candidate;
}

function optionalArray(value: Record<string, unknown>, key: string): readonly unknown[] {
  const candidate = value[key];
  if (candidate === undefined || candidate === null) return [];
  if (!isUnknownArray(candidate)) invalid(`Invalid ${key}.`);
  return candidate;
}

function stringArray(value: Record<string, unknown>, key: string): readonly string[] {
  return array(value, key).map((item) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      invalid(`Invalid ${key} item.`);
    }
    return item;
  });
}
function optionalStringArray(value: Record<string, unknown>, key: string): readonly string[] {
  if (value[key] === undefined || value[key] === null) return [];
  return stringArray(value, key);
}

function optionalNonEmptyString(value: Record<string, unknown>, key: string, fallback: string): string {
  return value[key] === undefined || value[key] === null ? fallback : nonEmptyString(value, key);
}

function optionalBoolean(value: Record<string, unknown>, key: string, fallback: boolean): boolean {
  return value[key] === undefined || value[key] === null ? fallback : boolean(value, key);
}

function optionalPositiveInteger(value: Record<string, unknown>, key: string, fallback: number): number {
  return value[key] === undefined || value[key] === null ? fallback : positiveInteger(value, key);
}

function optionalNumber(value: Record<string, unknown>, key: string, fallback: number): number {
  const candidate = value[key];
  if (candidate === undefined || candidate === null) return fallback;
  if (typeof candidate !== 'number' || !Number.isFinite(candidate)) invalid(`Invalid ${key}.`);
  return candidate;
}

function nullableBoundedNumber(value: Record<string, unknown>, key: string): number | null {
  const candidate = value[key];
  if (candidate === undefined || candidate === null) return null;
  if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < 0 || candidate > 1) {
    invalid(`Invalid ${key}.`);
  }
  return candidate;
}

function optionalNonNegativeInteger(
  value: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  return value[key] === undefined || value[key] === null ? fallback : nonNegativeInteger(value, key);
}

function nonEmptyString(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    invalid(`Invalid ${key}.`);
  }
  return candidate;
}

function nullableNonEmptyString(value: Record<string, unknown>, key: string): string | null {
  const candidate = value[key];
  if (candidate === null || candidate === undefined) return null;
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    invalid(`Invalid ${key}.`);
  }
  return candidate;
}

function uuid(value: Record<string, unknown>, key: string): string {
  const candidate = nonEmptyString(value, key);
  if (!isReportIdentifier(candidate)) invalid(`Invalid ${key}.`);
  return candidate;
}

function nullableUuid(value: Record<string, unknown>, key: string): string | null {
  const candidate = value[key];
  if (candidate === null || candidate === undefined) return null;
  if (typeof candidate !== 'string' || !UUID_PATTERN.test(candidate)) {
    invalid(`Invalid ${key}.`);
  }
  return candidate;
}

function optionalUuid(value: Record<string, unknown>, key: string): string | undefined {
  const candidate = value[key];
  if (candidate === undefined || candidate === null) return undefined;
  if (typeof candidate !== 'string' || !UUID_PATTERN.test(candidate)) invalid(`Invalid ${key}.`);
  return candidate;
}

function optionalAccountId(value: Record<string, unknown>): string {
  if (value['platformAccountId'] !== null && value['platformAccountId'] !== undefined) {
    return uuid(value, 'platformAccountId');
  }
  return uuid(value, 'channelId');
}

function optionalPlatformCode(value: Record<string, unknown>): string {
  const code = value['platformCode'];
  return typeof code === 'string' && code.trim() ? code : 'YOUTUBE';
}

function instant(value: Record<string, unknown>, key: string): string {
  const candidate = nonEmptyString(value, key);
  if (!ISO_INSTANT_PATTERN.test(candidate) || Number.isNaN(Date.parse(candidate))) {
    invalid(`Invalid ${key}.`);
  }
  return candidate;
}

function nullableInstant(value: Record<string, unknown>, key: string): string | null {
  const candidate = value[key];
  if (candidate === null || candidate === undefined) return null;
  if (
    typeof candidate !== 'string' ||
    !ISO_INSTANT_PATTERN.test(candidate) ||
    Number.isNaN(Date.parse(candidate))
  ) {
    invalid(`Invalid ${key}.`);
  }
  return candidate;
}

function nonNegativeInteger(value: Record<string, unknown>, key: string): number {
  const candidate = value[key];
  if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate < 0) {
    invalid(`Invalid ${key}.`);
  }
  return candidate;
}

function positiveInteger(value: Record<string, unknown>, key: string): number {
  const candidate = nonNegativeInteger(value, key);
  if (candidate === 0) invalid(`Invalid ${key}.`);
  return candidate;
}

function nullablePositiveInteger(value: Record<string, unknown>, key: string): number | null {
  const candidate = value[key];
  if (candidate === null || candidate === undefined) return null;
  return positiveInteger(value, key);
}

function nullableNonNegativeInteger(value: Record<string, unknown>, key: string): number | null {
  const candidate = value[key];
  if (candidate === null || candidate === undefined) return null;
  return nonNegativeInteger(value, key);
}

function ideaCount(value: Record<string, unknown>, key: string): number {
  const candidate = positiveInteger(value, key);
  if (candidate > 10) invalid(`Invalid ${key}.`);
  return candidate;
}

function boolean(value: Record<string, unknown>, key: string): boolean {
  const candidate = value[key];
  if (typeof candidate !== 'boolean') invalid(`Invalid ${key}.`);
  return candidate;
}

function finalStatus(value: unknown): ReportFinalStatus {
  switch (value) {
    case 'COMPLETED':
    case 'FAILED':
    case 'CANCELLED':
      return value;
    default:
      invalid('Invalid report final status.');
  }
}

function ensureUnique(values: readonly (string | number)[], message: string): void {
  if (new Set(values).size !== values.length) invalid(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function invalid(message: string): never {
  throw new InvalidReportResponseError(message);
}
