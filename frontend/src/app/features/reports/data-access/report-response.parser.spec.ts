import { describe, expect, it } from 'vitest';
import { InvalidReportResponseError, parseReportDetail } from './report-response.parser';

describe('report-contract-v3 parser', () => {
  it('accepts a complete spoken report and preserves its continuous timeline', () => {
    const parsed = parseReportDetail(v3Response());
    expect(parsed.title).toBe('Signals claros no Angular');
    expect(parsed.formatDecision?.format).toBe('SHORT_FORM');
    expect(parsed.formatDecision?.alternatives).toEqual([]);
    expect(parsed.totalEstimatedDurationSeconds).toBe(55);
    expect(parsed.sections?.map((section) => section.spokenScript)).toEqual([
      'Fala HOOK válida para o criador.', 'Fala PROBLEM válida para o criador.',
      'Fala SOLUTION válida para o criador.', 'Fala DIFFERENTIATOR válida para o criador.',
    ]);
  });

  it('accepts validated historical alternatives and rejects an invented duplicate recommendation', () => {
    const response = v3Response();
    response['formatDecision'] = {
      ...(response['formatDecision'] as Record<string, unknown>),
      historicalAffinity: .84,
      historicalEvidenceCount: 9,
      alternatives: [
        { format: 'STANDARD_VIDEO', historicalAffinity: .73, confidence: .82,
          evidenceCount: 7, recentUsagePenalty: .2 },
        { format: 'LONG_FORM', historicalAffinity: .61, confidence: .78,
          evidenceCount: 4, recentUsagePenalty: .1 },
      ],
    };

    const parsed = parseReportDetail(response);
    expect(parsed.formatDecision?.alternatives?.map((option) => option.format))
      .toEqual(['STANDARD_VIDEO', 'LONG_FORM']);

    (response['formatDecision'] as Record<string, unknown>)['alternatives'] = [
      { format: 'SHORT_FORM', historicalAffinity: .9, confidence: .9,
        evidenceCount: 5, recentUsagePenalty: 0 },
    ];
    expect(() => parseReportDetail(response)).toThrow(/alternative/i);
  });

  it('accepts a variable narrative structure without changing report-contract-v3', () => {
    const response = v3Response();
    response['sections'] = [
      section('OPENING', 0, 8, 'Transição para o contexto.'),
      section('CONTEXT', 8, 18, 'Transição para os itens.'),
      section('ITEMS', 18, 42, 'Transição para a síntese.'),
      section('SYNTHESIS', 42, 50, 'Transição para a conclusão.'),
      section('CONCLUSION', 50, 55, null),
    ];

    const parsed = parseReportDetail(response);

    expect(parsed.scriptContractVersion).toBe('report-contract-v3');
    expect(parsed.sections?.map((item) => item.key)).toEqual([
      'OPENING', 'CONTEXT', 'ITEMS', 'SYNTHESIS', 'CONCLUSION',
    ]);
  });

  it('rejects duplicated section keys in a variable narrative structure', () => {
    const response = v3Response();
    (response['sections'] as Record<string, unknown>[])[1]['key'] = 'HOOK';
    expect(() => parseReportDetail(response)).toThrow(/sections/i);
  });

  it('preserves a legacy report without inventing spoken fields', () => {
    const legacy = v3Response();
    delete legacy['scriptContractVersion']; delete legacy['formatDecision'];
    delete legacy['totalEstimatedDurationSeconds']; delete legacy['totalEstimatedDurationLabel'];
    legacy['sections'] = [];
    const parsed = parseReportDetail(legacy);
    expect(parsed.scriptContractVersion).toBeNull();
    expect(parsed.sections).toEqual([]);
  });

  it('rejects a missing spoken transition', () => {
    const response = v3Response();
    (response['sections'] as Record<string, unknown>[])[1]['transitionToNextSection'] = null;
    expect(() => parseReportDetail(response)).toThrow(InvalidReportResponseError);
  });

  it('rejects a timeline overlap or gap', () => {
    const response = v3Response();
    (response['sections'] as Record<string, unknown>[])[2]['startSecond'] = 28;
    expect(() => parseReportDetail(response)).toThrow(/timeline/i);
  });

  it('rejects a total that differs from the final section end', () => {
    const response = v3Response(); response['totalEstimatedDurationSeconds'] = 54;
    expect(() => parseReportDetail(response)).toThrow(/total duration/i);
  });
});

function v3Response(): Record<string, any> {
  const sections = [
    section('HOOK', 0, 7, 'Transição do gancho.'),
    section('PROBLEM', 7, 17, 'Transição do problema.'),
    section('SOLUTION', 17, 45, 'Transição da solução.'),
    section('DIFFERENTIATOR', 45, 55, null),
  ];
  return {
    id: '00000000-0000-4000-8000-000000000001', requestId: '00000000-0000-4000-8000-000000000002',
    platformAccountId: '00000000-0000-4000-8000-000000000003', platformCode: 'YOUTUBE',
    platformHandle: '@havk', channelId: '00000000-0000-4000-8000-000000000003', channelName: 'HAVK',
    requestedTopic: 'Signals', title: 'Signals claros no Angular', summary: 'Resumo válido.',
    recommendedFormat: 'SHORT_FORM', formatRecommendationReason: 'Preferência explícita.',
    formatDecision: { format: 'SHORT_FORM', reason: 'Preferência explícita.', confidence: .9,
      metricsUsed: ['preferência explícita'], limitations: [], targetDurationSeconds: 55 },
    totalEstimatedDurationSeconds: 55, totalEstimatedDurationLabel: '0:55', estimatedWordCount: 140,
    speakingRateWordsPerMinute: 165, scriptContractVersion: 'report-contract-v3',
    schemaVersion: 'report-contract-v3', promptVersion: 'spoken-script-adaptive-v3', evidenceSummary: [],
    dataCollectedAt: null, generatedAt: '2026-07-30T12:00:00Z', createdAt: '2026-07-30T12:00:01Z',
    ideas: [], sources: [], sections, trends: [],
  };
}

function section(key: string, startSecond: number, endSecond: number, transition: string | null) {
  return { key, content: `Editorial ${key}`, purpose: `Propósito ${key}`, reasoning: null, impact: null,
    context: null, consequence: null, relationship: null, expectedOutcome: null, variations: [], keyPoints: [], evidence: [],
    spokenScript: `Fala ${key} válida para o criador.`, transitionToNextSection: transition,
    modelEstimatedSeconds: endSecond - startSecond, calculatedSpeechSeconds: endSecond - startSecond,
    estimatedSpeechSeconds: endSecond - startSecond, estimatedSpeechLabel: `0:${String(endSecond - startSecond).padStart(2, '0')}`,
    startSecond, endSecond, deliveryNotes: 'Tom natural.', structuredEvidence: [] };
}
