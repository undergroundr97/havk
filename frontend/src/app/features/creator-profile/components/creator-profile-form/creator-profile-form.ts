import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import {
  form,
  FormField,
  maxLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import { apiErrorMessage } from '../../../../core/http/api-error-message';
import {
  CreatorProfileFormModel,
  EMPTY_CREATOR_PROFILE_FORM,
  formModelToProfileRequest,
  profileToFormModel,
  textToItems,
} from '../../data-access/creator-profile.models';
import { CreatorProfileService } from '../../data-access/creator-profile.service';

export type CreatorProfileMode = 'onboarding' | 'edit';
type ViewStatus = 'idle' | 'loading' | 'empty' | 'success' | 'error';

interface CreatorProfileViewState {
  readonly status: ViewStatus;
  readonly message: string | null;
  readonly canRetryLoad?: boolean;
}

@Component({
  selector: 'app-creator-profile-form',
  standalone: true,
  imports: [FormField, RouterLink],
  templateUrl: './creator-profile-form.html',
  styleUrl: './creator-profile-form.scss',
})
export class CreatorProfileForm implements OnInit {
  private readonly service = inject(CreatorProfileService);

  readonly mode = input.required<CreatorProfileMode>();
  protected readonly viewState = signal<CreatorProfileViewState>({ status: 'idle', message: null });
  protected readonly model = signal<CreatorProfileFormModel>({ ...EMPTY_CREATOR_PROFILE_FORM });
  protected readonly completion = computed(() => {
    const value = this.model();
    const completed = [
      value.primaryNiche.trim(),
      value.targetAudience.trim(),
      value.language.trim(),
      textToItems(value.channelGoalsText).length > 0 ? 'complete' : '',
    ].filter(Boolean).length;
    return Math.round((completed / 4) * 100);
  });
  protected readonly profileForm = form(this.model, (profile) => {
    required(profile.primaryNiche, { message: 'Informe o nicho principal.' });
    maxLength(profile.primaryNiche, 120, { message: 'Use no máximo 120 caracteres.' });
    validate(profile.subNichesText, ({ value }) =>
      listTextError(value(), 10, 120, 'subnichos'),
    );
    required(profile.targetAudience, { message: 'Informe o público-alvo.' });
    maxLength(profile.targetAudience, 500, { message: 'Use no máximo 500 caracteres.' });
    required(profile.language, { message: 'Informe o idioma.' });
    maxLength(profile.language, 50, { message: 'Use no máximo 50 caracteres.' });
    maxLength(profile.targetRegion, 100, { message: 'Use no máximo 100 caracteres.' });
    maxLength(profile.communicationStyle, 300, { message: 'Use no máximo 300 caracteres.' });
    required(profile.channelGoalsText, { message: 'Informe ao menos um objetivo do canal.' });
    validate(profile.channelGoalsText, ({ value }) =>
      listTextError(value(), 10, 200, 'objetivos'),
    );
    validate(profile.preferredTopicsText, ({ value }) =>
      listTextError(value(), 20, 120, 'temas desejados'),
    );
    validate(profile.excludedTopicsText, ({ value }) =>
      listTextError(value(), 20, 120, 'temas excluídos'),
    );
    maxLength(profile.experienceLevel, 50, { message: 'Use no máximo 50 caracteres.' });
    maxLength(profile.publicationFrequency, 100, { message: 'Use no máximo 100 caracteres.' });
  });

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  protected async submitProfile(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.profileForm, {
      onInvalid: () => {
        this.viewState.set({
          status: 'error',
          message: 'Revise os campos destacados antes de salvar.',
        });
      },
      action: async () => {
        this.viewState.set({ status: 'loading', message: 'Salvando seu perfil…' });
        try {
          const saved = await this.service.saveProfile(formModelToProfileRequest(this.model()));
          this.model.set(profileToFormModel(saved));
          this.viewState.set({ status: 'success', message: 'Perfil salvo com sucesso.' });
        } catch (error: unknown) {
          this.viewState.set({
            status: 'error',
            message: apiErrorMessage(error, 'Não foi possível salvar seu perfil.'),
          });
        }
        return undefined;
      },
    });
  }

  protected async retryLoad(): Promise<void> {
    await this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    this.viewState.set({ status: 'loading', message: 'Carregando seu perfil…' });
    try {
      const profile = await this.service.getProfile();
      this.model.set(profileToFormModel(profile));
      this.viewState.set({ status: 'success', message: null });
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.model.set({ ...EMPTY_CREATOR_PROFILE_FORM });
        this.viewState.set({
          status: 'empty',
          message: 'Seu perfil ainda não foi criado. Preencha os campos para começar.',
        });
        return;
      }
      this.viewState.set({
        status: 'error',
        message: apiErrorMessage(error, 'Não foi possível carregar seu perfil.'),
        canRetryLoad: true,
      });
    }
  }
}

function listTextError(
  value: string,
  maxItems: number,
  maxItemLength: number,
  label: string,
): { readonly kind: string; readonly message: string } | null {
  const items = textToItems(value);
  if (items.length > maxItems) {
    return { kind: 'maxItems', message: `Informe no máximo ${maxItems} ${label}.` };
  }
  if (items.some((item) => item.length > maxItemLength)) {
    return {
      kind: 'maxItemLength',
      message: `Cada item deve ter no máximo ${maxItemLength} caracteres.`,
    };
  }
  return null;
}
