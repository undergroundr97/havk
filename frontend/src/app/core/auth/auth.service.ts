import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_CONFIG } from '../config/api-config';
import { AuthenticatedUser, CsrfTokenResponse, LoginRequest, OAuthAuthorizationResponse, RegisterRequest } from './auth.models';
import { AuthSessionStore } from './auth-session.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);
  private readonly store = inject(AuthSessionStore);
  private csrfRequest: Promise<void> | null = null;

  async restoreSession(): Promise<boolean> {
    this.store.loading();
    try {
      await this.ensureCsrfToken();
      const user = await firstValueFrom(this.http.get<AuthenticatedUser>(this.url('/api/auth/me')));
      this.store.authenticated(user);
      return true;
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.store.anonymous();
        return false;
      }
      this.store.failed('Não foi possível verificar sua sessão.');
      return false;
    }
  }

  async restoreOAuthSession(attempts = 3, retryDelayMs = 150): Promise<boolean> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (await this.restoreSession()) return true;
      if (this.store.session().status !== 'anonymous' || attempt === attempts - 1) return false;
      await delay(retryDelayMs * (attempt + 1));
    }
    return false;
  }

  async register(request: RegisterRequest): Promise<AuthenticatedUser> {
    await this.ensureCsrfToken();
    return firstValueFrom(
      this.http.post<AuthenticatedUser>(this.url('/api/auth/register'), request),
    );
  }

  async login(request: LoginRequest): Promise<AuthenticatedUser> {
    this.store.loading();
    try {
      await this.ensureCsrfToken();
      const user = await firstValueFrom(
        this.http.post<AuthenticatedUser>(this.url('/api/auth/login'), request),
      );
      this.csrfRequest = null;
      await this.ensureCsrfToken();
      this.store.authenticated(user);
      return user;
    } catch (error: unknown) {
      this.store.anonymous();
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.ensureCsrfToken();
      await firstValueFrom(this.http.post<void>(this.url('/api/auth/logout'), null));
    } finally {
      this.csrfRequest = null;
      this.store.anonymous();
    }
  }

  async startGoogleLogin(returnUrl = '/dashboard'): Promise<string> {
    await this.ensureCsrfToken();
    const response = await firstValueFrom(this.http.post<OAuthAuthorizationResponse>(
      this.url('/api/auth/google/authorize'), { returnUrl, replaceManualChannel: false },
    ));
    return this.externalUrl(response.authorizationUrl);
  }

  ensureCsrfToken(): Promise<void> {
    this.csrfRequest ??= firstValueFrom(
      this.http.get<CsrfTokenResponse>(this.url('/api/auth/csrf')),
    )
      .then(() => undefined)
      .catch((error: unknown) => {
        this.csrfRequest = null;
        throw error;
      });
    return this.csrfRequest;
  }

  private url(path: string): string {
    return `${this.apiConfig.baseUrl.replace(/\/$/, '')}${path}`;
  }

  private externalUrl(value: string): string {
    if (/^https:\/\//i.test(value)) return value;
    if (!value.startsWith('/')) throw new Error('Invalid authorization URL');
    return `${this.apiConfig.baseUrl.replace(/\/$/, '')}${value}`;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
