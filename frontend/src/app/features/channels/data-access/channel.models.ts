export type ChannelPlatform = 'YOUTUBE';

export interface ChannelResponse {
  readonly id: string;
  readonly platform: ChannelPlatform;
  readonly name: string;
  readonly description: string | null;
  readonly url: string;
  readonly externalIdentifier: string | null;
  readonly approximateSize: number | null;
  readonly mainCategory: string;
  readonly language: string;
  readonly dataOrigin?: 'MANUAL' | 'YOUTUBE_AUTHORIZED';
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type YouTubeConnectionStatus =
  | 'NOT_CONNECTED'
  | 'AUTHORIZATION_PENDING'
  | 'CONNECTED'
  | 'REAUTHORIZATION_REQUIRED'
  | 'DISCONNECTED'
  | 'ERROR';

export interface YouTubeConnectionResponse {
  readonly status: YouTubeConnectionStatus;
  readonly channelName: string | null;
  readonly channelExternalId: string | null;
  readonly channelUrl: string | null;
  readonly connectedAt: string | null;
  readonly accessTokenExpiresAt: string | null;
  readonly failureCode: string | null;
}

export interface YouTubeAuthorizationResponse {
  readonly authorizationUrl: string;
  readonly expiresAt: string;
}

export type YouTubeSynchronizationStatus =
  | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'INSUFFICIENT_DATA' | 'FAILED' | 'REAUTHORIZATION_REQUIRED';
export type YouTubeSynchronizationStage =
  | 'QUEUED' | 'VALIDATING_CONNECTION' | 'COLLECTING_CHANNEL' | 'COLLECTING_ANALYTICS' | 'PERSISTING' | 'FINISHED';
export interface YouTubeSynchronizationResponse {
  readonly id: string;
  readonly status: YouTubeSynchronizationStatus;
  readonly stage: YouTubeSynchronizationStage;
  readonly source: 'SIMULATED' | 'YOUTUBE' | null;
  readonly simulated: boolean;
  readonly coverage: string | null;
  readonly limitations: string | null;
  readonly failureCode: string | null;
  readonly startedAt: string | null;
  readonly collectedAt: string | null;
  readonly completedAt: string | null;
  readonly videoCount: number;
}

export interface ChannelRequest {
  readonly platform: ChannelPlatform;
  readonly name: string;
  readonly description: string | null;
  readonly url: string;
  readonly externalIdentifier: string | null;
  readonly approximateSize: number | null;
  readonly mainCategory: string;
  readonly language: string;
}

export interface ChannelFormModel {
  platform: ChannelPlatform;
  name: string;
  description: string;
  url: string;
  externalIdentifier: string;
  approximateSize: string;
  mainCategory: string;
  language: string;
}

export const EMPTY_CHANNEL_FORM: ChannelFormModel = {
  platform: 'YOUTUBE',
  name: '',
  description: '',
  url: '',
  externalIdentifier: '',
  approximateSize: '',
  mainCategory: '',
  language: '',
};

export function channelToFormModel(channel: ChannelResponse): ChannelFormModel {
  return {
    platform: channel.platform,
    name: channel.name,
    description: channel.description ?? '',
    url: channel.url,
    externalIdentifier: channel.externalIdentifier ?? '',
    approximateSize: channel.approximateSize?.toString() ?? '',
    mainCategory: channel.mainCategory,
    language: channel.language,
  };
}

export function formModelToChannelRequest(model: ChannelFormModel): ChannelRequest {
  const approximateSize = model.approximateSize.trim();
  return {
    platform: model.platform,
    name: model.name.trim(),
    description: optionalText(model.description),
    url: model.url.trim(),
    externalIdentifier: optionalText(model.externalIdentifier),
    approximateSize: approximateSize ? Number(approximateSize) : null,
    mainCategory: model.mainCategory.trim(),
    language: model.language.trim(),
  };
}

function optionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}
