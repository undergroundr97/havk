import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField, maxLength, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import { apiErrorMessage } from '../../../../core/http/api-error-message';
import { textToItems } from '../../data-access/creator-profile.models';
import {
  EMPTY_PROFILE_REVIEW_FORM,
  FIELD_FORM_KEYS,
  LIST_FIELDS,
  ProfileFieldName,
  ProfileReviewDecision,
  ProfileReviewField,
  ProfileReviewFormModel,
  ProfileReviewRequest,
  ProfileReviewResponse,
} from '../../data-access/profile-review.models';
import { CreatorProfileService } from '../../data-access/creator-profile.service';
import { PlatformAccountSelector } from '../../../platform-accounts/components/platform-account-selector/platform-account-selector';

type ViewStatus = 'loading' | 'success' | 'empty' | 'error' | 'saving';

@Component({
  selector: 'app-creator-profile-review-page',
  standalone: true,
  imports: [FormField, RouterLink, PlatformAccountSelector],
  templateUrl: './creator-profile-review-page.html',
  styleUrl: './creator-profile-review-page.scss',
})
export class CreatorProfileReviewPage implements OnInit {
  private readonly service = inject(CreatorProfileService);
  private readonly idempotencyKey = signal(crypto.randomUUID());

  protected readonly state = signal<{ status: ViewStatus; message: string | null }>({
    status: 'loading', message: 'Carregando a inferência mais recente…',
  });
  protected readonly review = signal<ProfileReviewResponse | null>(null);
  protected readonly model = signal<ProfileReviewFormModel>({ ...EMPTY_PROFILE_REVIEW_FORM });
  protected readonly decisions = signal<Record<ProfileFieldName, ProfileReviewDecision>>(
    emptyDecisions(),
  );
  protected readonly progress = computed(() => {
    const review = this.review();
    return review ? `${review.confirmedRequiredFields} de ${review.totalRequiredFields}` : '0 de 0';
  });
  protected readonly reviewForm = form(this.model, (profile) => {
    validate(profile.primaryNiche, ({ value }) => requiredDecisionError(
      value(), this.decisions().PRIMARY_NICHE,
    ));
    maxLength(profile.primaryNiche, 120);
    validate(profile.language, ({ value }) => requiredDecisionError(
      value(), this.decisions().LANGUAGE,
    ));
    maxLength(profile.language, 50);
    validate(profile.targetAudience, ({ value }) => requiredDecisionError(
      value(), this.decisions().PROBABLE_TARGET_AUDIENCE,
    ));
    maxLength(profile.targetAudience, 500);
    maxLength(profile.communicationStyle, 300);
    maxLength(profile.publicationFrequency, 100);
    validate(profile.subNiches, ({ value }) => listError(value(), 10, 120));
    validate(profile.predominantTopics, ({ value }) => listError(value(), 20, 120));
    validate(profile.bestPerformingTopics, ({ value }) => listError(value(), 20, 120));
    validate(profile.channelGoals, ({ value }) => listError(value(), 10, 200));
    validate(profile.channelGoals, ({ value }) => requiredDecisionError(
      value(), this.decisions().PROBABLE_CHANNEL_GOALS,
    ));
  });

  async ngOnInit(): Promise<void> { await this.load(); }
  protected async accountChanged(): Promise<void> { await this.load(); }

  protected choose(field: ProfileReviewField, decision: ProfileReviewDecision): void {
    let values: readonly string[] = this.values(field.name);
    if (decision === 'ACCEPT_SUGGESTION') values = field.suggestedValues;
    if (decision === 'KEEP_MANUAL') values = field.manualValues;
    this.setValues(field.name, values);
    this.decisions.update((current) => ({ ...current, [field.name]: decision }));
  }

  protected restore(field: ProfileReviewField): void { this.choose(field, 'ACCEPT_SUGGESTION'); }
  protected markEdited(field: ProfileFieldName): void {
    this.decisions.update((current) => ({ ...current, [field]: 'REPLACE' }));
  }
  protected decision(field: ProfileFieldName): ProfileReviewDecision { return this.decisions()[field]; }
  protected statusLabel(status: ProfileReviewResponse['status']): string {
    switch (status) {
      case 'INFERRED_PENDING_REVIEW': return 'Inferido, aguardando revisão';
      case 'PARTIALLY_CONFIRMED': return 'Parcialmente confirmado';
      case 'CONFIRMED': return 'Confirmado';
      case 'MANUAL': return 'Manual';
      case 'INSUFFICIENT_DATA': return 'Dados insuficientes';
    }
  }
  protected fieldStateLabel(field: ProfileReviewField): string {
    switch (field.state) {
      case 'SUGGESTED': return 'Sugestão pendente';
      case 'CONFIRMED': return 'Confirmado pelo usuário';
      case 'MANUAL': return 'Valor manual';
      case 'INSUFFICIENT_DATA': return 'Dados insuficientes';
    }
  }
  protected dataKindLabel(field: ProfileReviewField): string {
    switch (field.dataKind) {
      case 'OBSERVED': return 'Dado observado';
      case 'CALCULATED': return 'Dado calculado';
      case 'INFERRED': return 'Dado inferido';
      case 'INSUFFICIENT': return 'Dado insuficiente';
    }
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.reviewForm, {
      onInvalid: () => this.state.set({ status: 'error', message: 'Revise os campos destacados.' }),
      action: async () => {
        const review = this.review();
        if (!review) return undefined;
        this.state.set({ status: 'saving', message: 'Salvando suas decisões…' });
        try {
          const request: ProfileReviewRequest = {
            inferenceId: review.inferenceId,
            idempotencyKey: this.idempotencyKey(),
            decisions: review.fields.map((field) => ({
              field: field.name,
              decision: this.decision(field.name),
              values: this.values(field.name),
            })),
          };
          this.apply(await this.service.saveReview(request));
          this.idempotencyKey.set(crypto.randomUUID());
          this.state.set({ status: 'success', message: 'Revisão salva. Seu perfil efetivo foi atualizado.' });
        } catch (error: unknown) {
          this.state.set({ status: 'error', message: apiErrorMessage(error, 'Não foi possível salvar a revisão.') });
        }
        return undefined;
      },
    });
  }

  protected async retry(): Promise<void> { await this.load(); }
  protected fieldId(field: ProfileFieldName): string { return `review-${field.toLowerCase().replaceAll('_', '-')}`; }
  protected errors(field: ProfileFieldName) {
    switch (field) {
      case 'PRIMARY_NICHE': return this.reviewForm.primaryNiche().errors();
      case 'SUB_NICHES': return this.reviewForm.subNiches().errors();
      case 'LANGUAGE': return this.reviewForm.language().errors();
      case 'PROBABLE_TARGET_AUDIENCE': return this.reviewForm.targetAudience().errors();
      case 'COMMUNICATION_STYLE': return this.reviewForm.communicationStyle().errors();
      case 'PUBLICATION_FREQUENCY': return this.reviewForm.publicationFrequency().errors();
      case 'PREDOMINANT_TOPICS': return this.reviewForm.predominantTopics().errors();
      case 'BEST_PERFORMING_TOPICS': return this.reviewForm.bestPerformingTopics().errors();
      case 'PROBABLE_CHANNEL_GOALS': return this.reviewForm.channelGoals().errors();
    }
  }

  private async load(): Promise<void> {
    this.idempotencyKey.set(crypto.randomUUID());
    this.state.set({ status: 'loading', message: 'Carregando a inferência mais recente…' });
    try {
      this.apply(await this.service.getReview());
      this.state.set({ status: 'success', message: null });
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.state.set({ status: 'empty', message: 'Sincronize o YouTube para gerar um perfil automático.' });
      } else {
        this.state.set({ status: 'error', message: apiErrorMessage(error, 'Não foi possível carregar a revisão.') });
      }
    }
  }

  private apply(review: ProfileReviewResponse): void {
    const model = { ...EMPTY_PROFILE_REVIEW_FORM };
    const decisions = emptyDecisions();
    for (const field of review.fields) {
      const values = field.effectiveValues.length > 0 ? field.effectiveValues : field.suggestedValues;
      model[FIELD_FORM_KEYS[field.name]] = values.join(LIST_FIELDS.has(field.name) ? '\n' : '');
      decisions[field.name] = field.confirmedValues.length > 0 ? 'REPLACE'
        : field.manualValues.length > 0 ? 'KEEP_MANUAL'
          : field.suggestedValues.length > 0 ? 'ACCEPT_SUGGESTION' : 'IGNORE';
    }
    this.model.set(model);
    this.decisions.set(decisions);
    this.review.set(review);
  }

  private values(field: ProfileFieldName): string[] {
    const value = this.model()[FIELD_FORM_KEYS[field]];
    return LIST_FIELDS.has(field) ? textToItems(value) : value.trim() ? [value.trim()] : [];
  }

  private setValues(field: ProfileFieldName, values: readonly string[]): void {
    this.model.update((current) => ({
      ...current,
      [FIELD_FORM_KEYS[field]]: values.join(LIST_FIELDS.has(field) ? '\n' : ''),
    }));
  }
}

function emptyDecisions(): Record<ProfileFieldName, ProfileReviewDecision> {
  return {
    PRIMARY_NICHE: 'IGNORE', SUB_NICHES: 'IGNORE', LANGUAGE: 'IGNORE',
    PROBABLE_TARGET_AUDIENCE: 'IGNORE', COMMUNICATION_STYLE: 'IGNORE',
    PUBLICATION_FREQUENCY: 'IGNORE', PREDOMINANT_TOPICS: 'IGNORE',
    BEST_PERFORMING_TOPICS: 'IGNORE', PROBABLE_CHANNEL_GOALS: 'IGNORE',
  };
}

function listError(value: string, maxItems: number, maxLength: number) {
  const items = textToItems(value);
  if (items.length > maxItems) return { kind: 'maxItems', message: `Use no máximo ${maxItems} itens.` };
  if (items.some((item) => item.length > maxLength)) {
    return { kind: 'maxItemLength', message: `Cada item deve ter no máximo ${maxLength} caracteres.` };
  }
  return null;
}

function requiredDecisionError(value: string, decision: ProfileReviewDecision) {
  return decision !== 'IGNORE' && value.trim().length === 0
    ? { kind: 'required', message: 'Informe um valor ou escolha Ignorar.' }
    : null;
}
