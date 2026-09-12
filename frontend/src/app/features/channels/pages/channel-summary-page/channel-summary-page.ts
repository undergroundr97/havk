import { HttpErrorResponse } from '@angular/common/http';
import { Component, DOCUMENT, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { apiErrorMessage } from '../../../../core/http/api-error-message';
import { ChannelResponse, YouTubeConnectionResponse, YouTubeSynchronizationResponse } from '../../data-access/channel.models';
import { ChannelService } from '../../data-access/channel.service';

type ViewStatus = 'idle' | 'loading' | 'empty' | 'success' | 'error';

interface ChannelSummaryViewState {
  readonly status: ViewStatus;
  readonly message: string | null;
}

@Component({
  selector: 'app-channel-summary-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './channel-summary-page.html',
  styleUrl: './channel-summary-page.scss',
})
export class ChannelSummaryPage implements OnInit {
  private readonly service = inject(ChannelService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly connectButton = viewChild<ElementRef<HTMLButtonElement>>('connectButton');
  private readonly disconnectButton = viewChild<ElementRef<HTMLButtonElement>>('disconnectButton');
  private readonly replacementDialog = viewChild<ElementRef<HTMLElement>>('replacementDialog');
  private readonly disconnectDialog = viewChild<ElementRef<HTMLElement>>('disconnectDialog');

  protected readonly channel = signal<ChannelResponse | null>(null);
  protected readonly connection = signal<YouTubeConnectionResponse | null>(null);
  protected readonly connectionBusy = signal(false);
  protected readonly connectionMessage = signal<string | null>(null);
  protected readonly synchronization = signal<YouTubeSynchronizationResponse | null>(null);
  protected readonly synchronizationBusy = signal(false);
  protected readonly confirmReplacement = signal(false);
  protected readonly confirmDisconnect = signal(false);
  protected readonly viewState = signal<ChannelSummaryViewState>({
    status: 'idle',
    message: 'Preparando os dados do canal…',
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadChannel(), this.loadConnection(), this.loadSynchronization()]);
  }

  protected async requestConnection(): Promise<void> {
    const channel = this.channel();
    if (channel?.dataOrigin !== 'YOUTUBE_AUTHORIZED' && !!channel?.externalIdentifier) {
      this.openReplacementConfirmation();
      return;
    }
    await this.startConnection(false);
  }

  protected async startConnection(replaceManualChannel: boolean): Promise<void> {
    if (this.connectionBusy()) return;
    this.confirmReplacement.set(false);
    this.connectionBusy.set(true);
    this.connectionMessage.set(null);
    try {
      this.document.location.assign(await this.service.startYouTubeConnection(replaceManualChannel));
    } catch (error: unknown) {
      this.connectionBusy.set(false);
      this.connectionMessage.set(apiErrorMessage(error, 'Não foi possível iniciar a conexão.'));
    }
  }

  protected async refreshConnection(): Promise<void> {
    this.connectionBusy.set(true);
    try {
      this.connection.set(await this.service.refreshYouTubeConnection());
      this.connectionMessage.set('Autorização renovada com sucesso.');
    } catch (error: unknown) {
      this.connectionMessage.set(apiErrorMessage(error, 'Não foi possível renovar a autorização.'));
    } finally { this.connectionBusy.set(false); }
  }

  protected async disconnect(): Promise<void> {
    this.confirmDisconnect.set(false);
    this.connectionBusy.set(true);
    try {
      await this.service.disconnectYouTube();
      const connection = await this.service.getYouTubeConnection();
      this.connection.set(connection);
      this.connectionMessage.set(connection.failureCode === 'OAUTH_REVOCATION_FAILED'
        ? 'A conexão local foi removida, mas o Google não confirmou a revogação. Revogue também o acesso na sua conta Google.'
        : 'YouTube desconectado. Sua conta HAVK e seus dados foram preservados.');
    } catch (error: unknown) {
      this.connectionMessage.set(apiErrorMessage(error, 'Não foi possível desconectar o YouTube.'));
    } finally { this.connectionBusy.set(false); }
  }

  protected openReplacementConfirmation(): void {
    this.confirmReplacement.set(true);
    queueMicrotask(() => this.focusFirstButton(this.replacementDialog()?.nativeElement));
  }

  protected closeReplacementConfirmation(): void {
    this.confirmReplacement.set(false);
    queueMicrotask(() => this.connectButton()?.nativeElement.focus());
  }

  protected openDisconnectConfirmation(): void {
    this.confirmDisconnect.set(true);
    queueMicrotask(() => this.focusFirstButton(this.disconnectDialog()?.nativeElement));
  }

  protected closeDisconnectConfirmation(): void {
    this.confirmDisconnect.set(false);
    queueMicrotask(() => this.disconnectButton()?.nativeElement.focus());
  }

  protected handleConfirmationKeydown(event: KeyboardEvent, kind: 'replacement' | 'disconnect'): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      kind === 'replacement' ? this.closeReplacementConfirmation() : this.closeDisconnectConfirmation();
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = event.currentTarget as HTMLElement;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    if (buttons.length === 0) return;
    const first = buttons[0], last = buttons.at(-1)!;
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected async retryLoad(): Promise<void> {
    await this.loadChannel();
  }

  protected async deleteChannel(): Promise<void> {
    if (this.viewState().status === 'loading') return;
    this.viewState.set({ status: 'loading', message: 'Excluindo o canal…' });
    try {
      await this.service.deleteChannel();
      this.channel.set(null);
      this.viewState.set({ status: 'success', message: 'Canal excluído com sucesso.' });
      await this.router.navigateByUrl('/canal/novo');
    } catch (error: unknown) {
      this.viewState.set({
        status: 'error',
        message: apiErrorMessage(error, 'Não foi possível excluir o canal.'),
      });
    }
  }

  protected formatApproximateSize(value: number | null): string {
    return value === null ? 'Não informado' : value.toLocaleString('pt-BR');
  }

  protected async synchronize(): Promise<void> {
    if (this.synchronizationBusy() || this.connection()?.status !== 'CONNECTED') return;
    this.synchronizationBusy.set(true); this.connectionMessage.set(null);
    try { const result=await this.service.synchronizeYouTube();this.synchronization.set(result);this.connectionMessage.set(this.synchronizationMessage(result));if(result.status==='REAUTHORIZATION_REQUIRED')await this.loadConnection(); }
    catch(error:unknown){this.connectionMessage.set(apiErrorMessage(error,'Não foi possível sincronizar o canal.'));}
    finally{this.synchronizationBusy.set(false);}
  }

  protected formatDate(value:string):string{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}

  protected synchronizationMessage(value:YouTubeSynchronizationResponse):string { switch(value.status){case 'PENDING':return 'Sincronização pendente.';case 'RUNNING':return 'Coleta em andamento.';case 'COMPLETED':return `Coleta concluída com ${value.videoCount} vídeos.`;case 'INSUFFICIENT_DATA':return value.limitations??'A coleta terminou com dados insuficientes.';case 'REAUTHORIZATION_REQUIRED':return 'Reconecte o YouTube para atualizar os dados.';case 'FAILED':return value.failureCode==='YOUTUBE_TEMPORARY_ERROR'||value.failureCode==='YOUTUBE_RATE_LIMITED'||value.failureCode==='YOUTUBE_PROVIDER_TIMEOUT'?'O YouTube está temporariamente indisponível. Tente novamente.':'A coleta não pôde ser concluída.';} }

  private async loadChannel(): Promise<void> {
    this.viewState.set({ status: 'loading', message: 'Carregando o canal…' });
    try {
      const channel = await this.service.getChannel();
      this.channel.set(channel);
      this.viewState.set({ status: 'success', message: null });
    } catch (error: unknown) {
      this.channel.set(null);
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.viewState.set({
          status: 'empty',
          message: 'Você ainda não cadastrou um canal.',
        });
        return;
      }
      this.viewState.set({
        status: 'error',
        message: apiErrorMessage(error, 'Não foi possível carregar o canal.'),
      });
    }
  }

  private async loadConnection(): Promise<void> {
    try { this.connection.set(await this.service.getYouTubeConnection()); }
    catch (error: unknown) { this.connectionMessage.set(apiErrorMessage(error, 'Não foi possível carregar o estado da conexão.')); }
  }

  private async loadSynchronization():Promise<void>{try{this.synchronization.set(await this.service.getLatestYouTubeSynchronization());}catch(error:unknown){this.connectionMessage.set(apiErrorMessage(error,'Não foi possível carregar a última sincronização.'));}}

  private focusFirstButton(dialog: HTMLElement | undefined): void {
    dialog?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }
}
