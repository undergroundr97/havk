import { Component, DOCUMENT, inject, signal } from '@angular/core';
import {
  email,
  form,
  FormField,
  maxLength,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../../core/http/api-error-message';

interface RegisterFormModel {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type SubmissionState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [FormField, RouterLink],
  templateUrl: './register-page.html',
  styleUrl: '../../auth-form.scss',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  protected readonly submissionState = signal<SubmissionState>('idle');
  protected readonly submissionMessage = signal<string | null>(null);
  protected readonly model = signal<RegisterFormModel>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  protected readonly registrationForm = form(this.model, (registration) => {
    required(registration.name, { message: 'Informe seu nome.' });
    minLength(registration.name, 2, { message: 'Use pelo menos 2 caracteres.' });
    maxLength(registration.name, 100, { message: 'Use no máximo 100 caracteres.' });
    required(registration.email, { message: 'Informe seu e-mail.' });
    email(registration.email, { message: 'Informe um e-mail válido.' });
    maxLength(registration.email, 254, { message: 'Use no máximo 254 caracteres.' });
    required(registration.password, { message: 'Crie uma senha.' });
    minLength(registration.password, 12, { message: 'Use pelo menos 12 caracteres.' });
    maxLength(registration.password, 128, { message: 'Use no máximo 128 caracteres.' });
    required(registration.confirmPassword, { message: 'Confirme sua senha.' });
    validate(registration.confirmPassword, ({ value, valueOf }) =>
      value() === valueOf(registration.password)
        ? undefined
        : { kind: 'passwordMismatch', message: 'As senhas precisam ser iguais.' },
    );
  });

  protected async submitRegistration(event: Event): Promise<void> {
    event.preventDefault();
    this.submissionMessage.set(null);
    await submit(this.registrationForm, {
      onInvalid: () => {
        this.submissionState.set('error');
        this.submissionMessage.set('Revise os campos destacados antes de continuar.');
      },
      action: async () => {
        this.submissionState.set('loading');
        const value = this.model();
        try {
          await this.auth.register({
            name: value.name.trim(),
            email: value.email.trim(),
            password: value.password,
          });
          this.submissionState.set('success');
          await this.router.navigate(['/login'], { queryParams: { registered: 'true' } });
        } catch (error: unknown) {
          this.submissionState.set('error');
          this.submissionMessage.set(
            apiErrorMessage(error, 'Não foi possível criar a conta. Tente novamente.'),
          );
        }
        return undefined;
      },
    });
  }

  protected async registerWithYouTube(): Promise<void> {
    if (this.submissionState() === 'loading') return;
    this.submissionState.set('loading');
    this.submissionMessage.set(null);
    try {
      this.document.location.assign(await this.auth.startGoogleLogin('/dashboard'));
    } catch (error: unknown) {
      this.submissionState.set('error');
      this.submissionMessage.set(apiErrorMessage(error, 'Não foi possível iniciar o cadastro com YouTube.'));
    }
  }
}
