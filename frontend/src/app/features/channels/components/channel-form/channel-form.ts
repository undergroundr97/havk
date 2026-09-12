import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { form, FormField, maxLength, required, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';

import { apiErrorMessage } from '../../../../core/http/api-error-message';
import {
  channelToFormModel,
  ChannelFormModel,
  EMPTY_CHANNEL_FORM,
  formModelToChannelRequest,
} from '../../data-access/channel.models';
import { ChannelService } from '../../data-access/channel.service';

export type ChannelFormMode = 'create' | 'edit';
type ViewStatus = 'idle' | 'loading' | 'empty' | 'success' | 'error';

interface ChannelFormViewState {
  readonly status: ViewStatus;
  readonly message: string | null;
  readonly canRetryLoad?: boolean;
}

@Component({
  selector: 'app-channel-form',
  standalone: true,
  imports: [FormField, RouterLink],
  templateUrl: './channel-form.html',
  styleUrl: './channel-form.scss',
})
export class ChannelForm implements OnInit {
  private readonly service = inject(ChannelService);
  private readonly router = inject(Router);

  readonly mode = input.required<ChannelFormMode>();
  protected readonly viewState = signal<ChannelFormViewState>({ status: 'idle', message: null });
  protected readonly model = signal<ChannelFormModel>({ ...EMPTY_CHANNEL_FORM });
  protected readonly channelForm = form(this.model, (channel) => {
    required(channel.name, { message: 'Informe o nome do canal.' });
    maxLength(channel.name, 120, { message: 'Use no máximo 120 caracteres.' });
    maxLength(channel.description, 2000, { message: 'Use no máximo 2000 caracteres.' });
    required(channel.url, { message: 'Informe a URL do canal.' });
    maxLength(channel.url, 2048, { message: 'Use no máximo 2048 caracteres.' });
    validate(channel.url, ({ value }) => urlError(value()));
    maxLength(channel.externalIdentifier, 255, { message: 'Use no máximo 255 caracteres.' });
    validate(channel.approximateSize, ({ value }) => approximateSizeError(value()));
    required(channel.mainCategory, { message: 'Informe a categoria do canal.' });
    maxLength(channel.mainCategory, 120, { message: 'Use no máximo 120 caracteres.' });
    required(channel.language, { message: 'Informe o idioma do canal.' });
    maxLength(channel.language, 50, { message: 'Use no máximo 50 caracteres.' });
  });

  async ngOnInit(): Promise<void> {
    if (this.mode() === 'edit') {
      await this.loadChannel();
    }
  }

  protected async submitChannel(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.channelForm, {
      onInvalid: () => {
        this.viewState.set({
          status: 'error',
          message: 'Revise os campos destacados antes de salvar.',
        });
      },
      action: async () => {
        this.viewState.set({ status: 'loading', message: 'Salvando o canal…' });
        try {
          const request = formModelToChannelRequest(this.model());
          const saved =
            this.mode() === 'create'
              ? await this.service.createChannel(request)
              : await this.service.updateChannel(request);
          this.model.set(channelToFormModel(saved));
          this.viewState.set({ status: 'success', message: 'Canal salvo com sucesso.' });
          await this.router.navigateByUrl('/canal');
        } catch (error: unknown) {
          this.viewState.set({
            status: 'error',
            message: apiErrorMessage(error, 'Não foi possível salvar o canal.'),
          });
        }
        return undefined;
      },
    });
  }

  protected async retryLoad(): Promise<void> {
    await this.loadChannel();
  }

  private async loadChannel(): Promise<void> {
    this.viewState.set({ status: 'loading', message: 'Carregando o canal…' });
    try {
      const channel = await this.service.getChannel();
      this.model.set(channelToFormModel(channel));
      this.viewState.set({ status: 'success', message: null });
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.model.set({ ...EMPTY_CHANNEL_FORM });
        this.viewState.set({
          status: 'empty',
          message: 'Nenhum canal foi cadastrado. Crie o canal antes de tentar editá-lo.',
        });
        return;
      }
      this.viewState.set({
        status: 'error',
        message: apiErrorMessage(error, 'Não foi possível carregar o canal.'),
        canRetryLoad: true,
      });
    }
  }
}

function urlError(value: string): { readonly kind: string; readonly message: string } | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname) return null;
  } catch {
    // A mensagem comum abaixo mantém o detalhe técnico fora da interface.
  }
  return { kind: 'url', message: 'Informe uma URL completa iniciada por http:// ou https://.' };
}

function approximateSizeError(
  value: string,
): { readonly kind: string; readonly message: string } | null {
  if (!value.trim()) return null;
  const size = Number(value);
  if (!Number.isSafeInteger(size) || size < 0 || size > 10_000_000_000) {
    return {
      kind: 'approximateSize',
      message: 'Informe um número inteiro entre 0 e 10 bilhões.',
    };
  }
  return null;
}
