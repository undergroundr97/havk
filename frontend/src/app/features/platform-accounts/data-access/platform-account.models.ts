export interface PlatformDefinition {
  readonly code: string;
  readonly displayName: string;
  readonly manualRegistration: boolean;
  readonly oauth: boolean;
  readonly synchronization: boolean;
  readonly automaticInference: boolean;
  readonly health: boolean;
  readonly analytics: boolean;
  readonly futurePublishing: boolean;
  readonly contentCapabilities: readonly string[];
}

export interface PlatformAccount {
  readonly id: string;
  readonly platformCode: string;
  readonly platformName: string;
  readonly displayName: string;
  readonly handle: string | null;
  readonly externalIdentifier: string | null;
  readonly publicUrl: string | null;
  readonly description: string | null;
  readonly language: string | null;
  readonly region: string | null;
  readonly dataOrigin: 'MANUAL' | 'OAUTH' | 'SIMULATED';
  readonly connectionStatus: string;
  readonly archived: boolean;
  readonly primaryAccount: boolean;
  readonly archivedAt: string | null;
  readonly profileConfigured: boolean;
  readonly profileReadiness: 'READY' | 'INCOMPLETE' | 'INFERENCE_PENDING' | 'REVIEW_REQUIRED' | 'UNAVAILABLE';
  readonly trendGenerationAvailable: boolean;
  readonly trendGenerationUnavailableReason: string | null;
  readonly healthAvailability: 'AVAILABLE' | 'INSUFFICIENT_DATA' | 'INTEGRATION_UNAVAILABLE';
  readonly lastSynchronizedAt: string | null;
  readonly capabilities: PlatformDefinition;
}

export interface PlatformAccountRequest {
  readonly platformCode: string;
  readonly displayName: string;
  readonly handle: string | null;
  readonly externalIdentifier: string | null;
  readonly publicUrl: string | null;
  readonly description: string | null;
  readonly language: string | null;
  readonly region: string | null;
  readonly initialNiche: string | null;
}

export interface PlatformAccountFormModel {
  platformCode: string;
  displayName: string;
  handle: string;
  externalIdentifier: string;
  publicUrl: string;
  description: string;
  language: string;
  region: string;
  initialNiche: string;
}

export const EMPTY_PLATFORM_ACCOUNT_FORM: PlatformAccountFormModel = {
  platformCode: 'INSTAGRAM', displayName: '', handle: '', externalIdentifier: '', publicUrl: '',
  description: '', language: 'pt-BR', region: 'BR', initialNiche: '',
};

export function toPlatformAccountRequest(model: PlatformAccountFormModel): PlatformAccountRequest {
  return {
    platformCode: model.platformCode,
    displayName: model.displayName.trim(),
    handle: optional(model.handle),
    externalIdentifier: optional(model.externalIdentifier),
    publicUrl: optional(model.publicUrl),
    description: optional(model.description),
    language: optional(model.language),
    region: optional(model.region),
    initialNiche: optional(model.initialNiche),
  };
}

function optional(value: string): string | null { return value.trim() || null; }
