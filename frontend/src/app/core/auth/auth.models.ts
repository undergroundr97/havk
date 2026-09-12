export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly lastName?: string | null;
  readonly email: string;
  readonly status: 'ACTIVE' | 'DISABLED';
  readonly registrationOrigin?: 'LOCAL' | 'GOOGLE_OAUTH';
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OAuthAuthorizationResponse {
  readonly authorizationUrl: string;
  readonly expiresAt: string;
}

export interface RegisterRequest {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface CsrfTokenResponse {
  readonly headerName: string;
  readonly token: string;
}
