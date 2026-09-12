export type ProfileFieldName =
  | 'PRIMARY_NICHE'
  | 'SUB_NICHES'
  | 'LANGUAGE'
  | 'PROBABLE_TARGET_AUDIENCE'
  | 'COMMUNICATION_STYLE'
  | 'PUBLICATION_FREQUENCY'
  | 'PREDOMINANT_TOPICS'
  | 'BEST_PERFORMING_TOPICS'
  | 'PROBABLE_CHANNEL_GOALS';

export type ProfileReviewDecision = 'ACCEPT_SUGGESTION' | 'REPLACE' | 'KEEP_MANUAL' | 'IGNORE';
export type ProfileReviewStatus =
  | 'INFERRED_PENDING_REVIEW'
  | 'PARTIALLY_CONFIRMED'
  | 'CONFIRMED'
  | 'MANUAL'
  | 'INSUFFICIENT_DATA';

export interface ProfileReviewEvidence {
  readonly type: string;
  readonly snapshotReference: string | null;
  readonly description: string;
}

export interface ProfileReviewField {
  readonly name: ProfileFieldName;
  readonly label: string;
  readonly required: boolean;
  readonly suggestedValues: readonly string[];
  readonly manualValues: readonly string[];
  readonly confirmedValues: readonly string[];
  readonly effectiveValues: readonly string[];
  readonly effectiveSource: string;
  readonly origin: string | null;
  readonly dataKind: 'OBSERVED' | 'CALCULATED' | 'INFERRED' | 'INSUFFICIENT';
  readonly confidence: number;
  readonly confidenceLabel: 'Alta' | 'Média' | 'Baixa' | 'Dados insuficientes';
  readonly evidence: readonly ProfileReviewEvidence[];
  readonly state: 'SUGGESTED' | 'CONFIRMED' | 'MANUAL' | 'INSUFFICIENT_DATA';
  readonly insufficientReason: string | null;
  readonly newSuggestion: boolean;
}

export interface ProfileReviewResponse {
  readonly inferenceId: string;
  readonly inferenceVersion: string;
  readonly inferredAt: string;
  readonly simulated: boolean;
  readonly status: ProfileReviewStatus;
  readonly confirmedRequiredFields: number;
  readonly totalRequiredFields: number;
  readonly remainingRequiredFields: number;
  readonly confirmedAt: string | null;
  readonly hasNewSuggestions: boolean;
  readonly fields: readonly ProfileReviewField[];
}

export interface ProfileReviewRequest {
  readonly inferenceId: string;
  readonly idempotencyKey: string;
  readonly decisions: readonly {
    readonly field: ProfileFieldName;
    readonly decision: ProfileReviewDecision;
    readonly values: readonly string[];
  }[];
}

export interface ProfileReviewFormModel {
  primaryNiche: string;
  subNiches: string;
  language: string;
  targetAudience: string;
  communicationStyle: string;
  publicationFrequency: string;
  predominantTopics: string;
  bestPerformingTopics: string;
  channelGoals: string;
}

export const EMPTY_PROFILE_REVIEW_FORM: ProfileReviewFormModel = {
  primaryNiche: '', subNiches: '', language: '', targetAudience: '', communicationStyle: '',
  publicationFrequency: '', predominantTopics: '', bestPerformingTopics: '', channelGoals: '',
};

export const FIELD_FORM_KEYS: Record<ProfileFieldName, keyof ProfileReviewFormModel> = {
  PRIMARY_NICHE: 'primaryNiche', SUB_NICHES: 'subNiches', LANGUAGE: 'language',
  PROBABLE_TARGET_AUDIENCE: 'targetAudience', COMMUNICATION_STYLE: 'communicationStyle',
  PUBLICATION_FREQUENCY: 'publicationFrequency', PREDOMINANT_TOPICS: 'predominantTopics',
  BEST_PERFORMING_TOPICS: 'bestPerformingTopics', PROBABLE_CHANNEL_GOALS: 'channelGoals',
};

export const LIST_FIELDS = new Set<ProfileFieldName>([
  'SUB_NICHES', 'PREDOMINANT_TOPICS', 'BEST_PERFORMING_TOPICS', 'PROBABLE_CHANNEL_GOALS',
]);
