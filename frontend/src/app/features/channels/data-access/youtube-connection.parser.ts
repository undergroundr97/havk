import { YouTubeConnectionResponse, YouTubeConnectionStatus } from './channel.models';

const STATUSES = new Set<YouTubeConnectionStatus>([
  'NOT_CONNECTED', 'AUTHORIZATION_PENDING', 'CONNECTED',
  'REAUTHORIZATION_REQUIRED', 'DISCONNECTED', 'ERROR',
]);

export function parseYouTubeConnection(value: unknown): YouTubeConnectionResponse {
  if (!isRecord(value) || typeof value['status'] !== 'string' || !STATUSES.has(value['status'] as YouTubeConnectionStatus)) {
    throw new Error('Invalid YouTube connection response');
  }
  return {
    status: value['status'] as YouTubeConnectionStatus,
    channelName: optionalString(value['channelName']),
    channelExternalId: optionalString(value['channelExternalId']),
    channelUrl: optionalString(value['channelUrl']),
    connectedAt: optionalString(value['connectedAt']),
    accessTokenExpiresAt: optionalString(value['accessTokenExpiresAt']),
    failureCode: optionalString(value['failureCode']),
  };
}
function optionalString(value: unknown): string | null { if (value == null) return null; if (typeof value !== 'string') throw new Error('Invalid YouTube connection response'); return value; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
