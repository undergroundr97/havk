import { PlatformAccount, PlatformDefinition } from './platform-account.models';

export function parsePlatforms(value: unknown): readonly PlatformDefinition[] {
  if (!Array.isArray(value)) throw new Error('Catálogo de plataformas inválido.');
  return value.map(parsePlatform);
}

export function parsePlatformAccounts(value: unknown): readonly PlatformAccount[] {
  if (!Array.isArray(value)) throw new Error('Lista de contas de plataforma inválida.');
  return value.map(parsePlatformAccount);
}

export function parsePlatformAccount(value: unknown): PlatformAccount {
  const item = record(value);
  const origin = text(item['dataOrigin']);
  if (origin !== 'MANUAL' && origin !== 'OAUTH' && origin !== 'SIMULATED') throw new Error('Origem inválida.');
  const health = text(item['healthAvailability']);
  if (health !== 'AVAILABLE' && health !== 'INSUFFICIENT_DATA' && health !== 'INTEGRATION_UNAVAILABLE') {
    throw new Error('Disponibilidade de saúde inválida.');
  }
  const profileReadiness = text(item['profileReadiness']);
  if (profileReadiness !== 'READY' && profileReadiness !== 'INCOMPLETE'
      && profileReadiness !== 'INFERENCE_PENDING' && profileReadiness !== 'REVIEW_REQUIRED'
      && profileReadiness !== 'UNAVAILABLE') {
    throw new Error('Prontidão do perfil inválida.');
  }
  return {
    id: text(item['id']), platformCode: text(item['platformCode']), platformName: text(item['platformName']),
    displayName: text(item['displayName']), handle: nullableText(item['handle']),
    externalIdentifier: nullableText(item['externalIdentifier']), publicUrl: nullableText(item['publicUrl']),
    description: nullableText(item['description']), language: nullableText(item['language']),
    region: nullableText(item['region']), dataOrigin: origin, connectionStatus: text(item['connectionStatus']),
    archived: bool(item['archived']), archivedAt: nullableText(item['archivedAt']),
    primaryAccount: item['primaryAccount'] === undefined ? false : bool(item['primaryAccount']),
    profileConfigured: bool(item['profileConfigured']), profileReadiness,
    trendGenerationAvailable: bool(item['trendGenerationAvailable']),
    trendGenerationUnavailableReason: nullableText(item['trendGenerationUnavailableReason']),
    healthAvailability: health,
    lastSynchronizedAt: nullableText(item['lastSynchronizedAt']), capabilities: parsePlatform(item['capabilities']),
  };
}

function parsePlatform(value: unknown): PlatformDefinition {
  const item = record(value);
  const formats = item['contentCapabilities'];
  if (!Array.isArray(formats) || !formats.every((entry) => typeof entry === 'string')) throw new Error('Capacidades inválidas.');
  return { code: text(item['code']), displayName: text(item['displayName']),
    manualRegistration: bool(item['manualRegistration']), oauth: bool(item['oauth']),
    synchronization: bool(item['synchronization']), automaticInference: bool(item['automaticInference']),
    health: bool(item['health']), analytics: bool(item['analytics']),
    futurePublishing: bool(item['futurePublishing']), contentCapabilities: formats };
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Resposta inválida.');
  return value as Record<string, unknown>;
}
function text(value: unknown): string { if (typeof value !== 'string' || !value.trim()) throw new Error('Texto inválido.'); return value; }
function nullableText(value: unknown): string | null { return value == null ? null : text(value); }
function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw new Error('Booleano inválido.'); return value; }
