export interface CreatorProfileResponse {
  readonly id: string;
  readonly primaryNiche: string;
  readonly subNiches: readonly string[];
  readonly targetAudience: string;
  readonly language: string;
  readonly targetRegion?: string;
  readonly communicationStyle?: string;
  readonly channelGoals: readonly string[];
  readonly preferredTopics: readonly string[];
  readonly excludedTopics: readonly string[];
  readonly experienceLevel?: string;
  readonly publicationFrequency?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatorProfileRequest {
  readonly primaryNiche: string;
  readonly subNiches: readonly string[];
  readonly targetAudience: string;
  readonly language: string;
  readonly targetRegion: string | null;
  readonly communicationStyle: string | null;
  readonly channelGoals: readonly string[];
  readonly preferredTopics: readonly string[];
  readonly excludedTopics: readonly string[];
  readonly experienceLevel: string | null;
  readonly publicationFrequency: string | null;
}

export interface CreatorProfileFormModel {
  primaryNiche: string;
  subNichesText: string;
  targetAudience: string;
  language: string;
  targetRegion: string;
  communicationStyle: string;
  channelGoalsText: string;
  preferredTopicsText: string;
  excludedTopicsText: string;
  experienceLevel: string;
  publicationFrequency: string;
}

export const EMPTY_CREATOR_PROFILE_FORM: CreatorProfileFormModel = {
  primaryNiche: '',
  subNichesText: '',
  targetAudience: '',
  language: '',
  targetRegion: '',
  communicationStyle: '',
  channelGoalsText: '',
  preferredTopicsText: '',
  excludedTopicsText: '',
  experienceLevel: '',
  publicationFrequency: '',
};

export function profileToFormModel(profile: CreatorProfileResponse): CreatorProfileFormModel {
  return {
    primaryNiche: profile.primaryNiche,
    subNichesText: profile.subNiches.join('\n'),
    targetAudience: profile.targetAudience,
    language: profile.language,
    targetRegion: profile.targetRegion ?? '',
    communicationStyle: profile.communicationStyle ?? '',
    channelGoalsText: profile.channelGoals.join('\n'),
    preferredTopicsText: profile.preferredTopics.join('\n'),
    excludedTopicsText: profile.excludedTopics.join('\n'),
    experienceLevel: profile.experienceLevel ?? '',
    publicationFrequency: profile.publicationFrequency ?? '',
  };
}

export function formModelToProfileRequest(model: CreatorProfileFormModel): CreatorProfileRequest {
  return {
    primaryNiche: model.primaryNiche.trim(),
    subNiches: textToItems(model.subNichesText),
    targetAudience: model.targetAudience.trim(),
    language: model.language.trim(),
    targetRegion: optionalText(model.targetRegion),
    communicationStyle: optionalText(model.communicationStyle),
    channelGoals: textToItems(model.channelGoalsText),
    preferredTopics: textToItems(model.preferredTopicsText),
    excludedTopics: textToItems(model.excludedTopicsText),
    experienceLevel: optionalText(model.experienceLevel),
    publicationFrequency: optionalText(model.publicationFrequency),
  };
}

export function textToItems(value: string): string[] {
  const unique = new Map<string, string>();
  for (const line of value.split(/\r?\n/)) {
    const item = line.trim();
    if (item) unique.set(item.toLocaleLowerCase(), item);
  }
  return [...unique.values()];
}

function optionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}
