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
  protected readonly model = signal<LoginFormModel>({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (login) => {
    required(login.email, { message: 'Informe seu e-mail.' });
    email(login.email, { message: 'Informe um e-mail válido.' });
    maxLength(login.email, 254, { message: 'Use no máximo 254 caracteres.' });
    required(login.password, { message: 'Informe sua senha.' });
    maxLength(login.password, 128, { message: 'Use no máximo 128 caracteres.' });
  });

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
        try {
          await this.auth.login({
            email: this.model().email.trim(),
            password: this.model().password,
          });
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
}
