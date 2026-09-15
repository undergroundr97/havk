import { Component, DOCUMENT, inject, signal } from '@angular/core';
import { email, form, FormField, maxLength, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { safeInternalReturnUrl } from '../../../../core/auth/safe-return-url';
import { apiErrorMessage } from '../../../../core/http/api-error-message';

interface LoginFormModel {
  email: string;
  password: string;
}

type SubmissionState = 'idle' | 'loading' | 'success' | 'error';

const REMEMBER_EMAIL_KEY = 'havk-remembered-email';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormField, RouterLink],
  templateUrl: './login-page.html',
  styleUrl: '../../auth-form.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  protected readonly submissionState = signal<SubmissionState>('idle');
  protected readonly submissionMessage = signal<string | null>(null);
  protected readonly registered = this.route.snapshot.queryParamMap.get('registered') === 'true';
  protected readonly rememberMe = signal(false);
  protected readonly model = signal<LoginFormModel>({
    email: this.readRememberedEmail() ?? '',
    password: '',
  });
  protected readonly loginForm = form(this.model, (login) => {
    required(login.email, { message: 'Informe seu e-mail.' });
    email(login.email, { message: 'Informe um e-mail válido.' });
    maxLength(login.email, 254, { message: 'Use no máximo 254 caracteres.' });
    required(login.password, { message: 'Informe sua senha.' });
    maxLength(login.password, 128, { message: 'Use no máximo 128 caracteres.' });
  });

  constructor() {
    if (this.readRememberedEmail()) this.rememberMe.set(true);
  }

  protected toggleRemember(event: Event): void {
    this.rememberMe.set((event.target as HTMLInputElement).checked);
  }

  protected async submitLogin(event: Event): Promise<void> {
    event.preventDefault();
    this.submissionMessage.set(null);
    await submit(this.loginForm, {
      onInvalid: () => {
        this.submissionState.set('error');
        this.submissionMessage.set('Revise os campos destacados antes de continuar.');
      },
      action: async () => {
        this.submissionState.set('loading');
        const email = this.model().email.trim();
        try {
          await this.auth.login({ email, password: this.model().password });
          this.persistRememberedEmail(email);
          this.submissionState.set('success');
          await this.router.navigateByUrl(this.safeReturnUrl());
        } catch (error: unknown) {
          this.submissionState.set('error');
          this.submissionMessage.set(
            apiErrorMessage(error, 'Não foi possível entrar. Verifique seus dados.'),
          );
        }
        return undefined;
      },
    });
  }

  protected async enterWithYouTube(): Promise<void> {
    if (this.submissionState() === 'loading') return;
    this.submissionState.set('loading');
    this.submissionMessage.set(null);
    try {
      this.document.location.assign(await this.auth.startGoogleLogin(this.safeReturnUrl()));
    } catch (error: unknown) {
      this.submissionState.set('error');
      this.submissionMessage.set(apiErrorMessage(error, 'Não foi possível iniciar a entrada com YouTube.'));
    }
  }

  private safeReturnUrl(): string {
    return safeInternalReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  private readRememberedEmail(): string | null {
    try {
      return localStorage.getItem(REMEMBER_EMAIL_KEY);
    } catch {
      return null;
    }
  }

  private persistRememberedEmail(email: string): void {
    try {
      if (this.rememberMe()) localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      else localStorage.removeItem(REMEMBER_EMAIL_KEY);
    } catch {
      /* ignore storage errors (e.g. private browsing) */
    }
  }
}
