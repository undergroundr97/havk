import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField, maxLength, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../../core/http/api-error-message';
import { PlatformAccountSelector } from '../../../platform-accounts/components/platform-account-selector/platform-account-selector';
import { PlatformAccountContextStore } from '../../../platform-accounts/data-access/platform-account-context.store';
import { ContentItem, EMPTY_TRANSCRIPT_FORM, TranscriptFormModel } from '../../data-access/content-memory.models';
import { ContentMemoryService } from '../../data-access/content-memory.service';

type ViewStatus = 'initial' | 'loading' | 'success' | 'empty' | 'error' | 'no-account';

@Component({
  selector: 'app-content-memory-page', standalone: true,
  imports: [DatePipe, FormField, PlatformAccountSelector],
  templateUrl: './content-memory-page.html', styleUrl: './content-memory-page.scss',
})
export class ContentMemoryPage implements OnInit {
  private readonly service = inject(ContentMemoryService);
  protected readonly accounts = inject(PlatformAccountContextStore);
  protected readonly status = signal<ViewStatus>('initial');
  protected readonly message = signal<string | null>(null);
  protected readonly contents = signal<readonly ContentItem[]>([]);
  protected readonly total = signal(0);
  protected readonly activeTranscriptId = signal<string | null>(null);
  protected readonly analyzingIds = signal<ReadonlySet<string>>(new Set());
  protected readonly transcriptModel = signal<TranscriptFormModel>({ ...EMPTY_TRANSCRIPT_FORM });
  protected readonly transcriptForm = form(this.transcriptModel, (fields) => {
    required(fields.transcriptText, { message: 'Informe a transcrição.' });
    maxLength(fields.transcriptText, 100_000, { message: 'Use no máximo 100.000 caracteres.' });
    maxLength(fields.language, 50, { message: 'Use no máximo 50 caracteres.' });
  });
  protected readonly activeContent = computed(() =>
    this.contents().find((content) => content.id === this.activeTranscriptId()) ?? null);

  async ngOnInit(): Promise<void> { await this.accounts.load(); await this.load(); }
  protected async accountChanged(): Promise<void> { this.closeTranscript(); await this.load(); }
  protected openTranscript(content: ContentItem): void {
    this.activeTranscriptId.set(content.id);
    this.transcriptModel.set({ transcriptText: '', language: content.language ?? '', partial: false });
  }
  protected closeTranscript(): void {
    this.activeTranscriptId.set(null); this.transcriptModel.set({ ...EMPTY_TRANSCRIPT_FORM });
  }
  protected async saveTranscript(event: Event): Promise<void> {
    event.preventDefault(); const accountId = this.accounts.selectedId(), contentId = this.activeTranscriptId();
    if (!accountId || !contentId) return;
    await submit(this.transcriptForm, { onInvalid: () => this.message.set('Revise a transcrição informada.'), action: async () => {
      try {
        const model = this.transcriptModel();
        await firstValueFrom(this.service.addTranscript(accountId, contentId, {
          transcriptText: model.transcriptText.trim(), language: model.language.trim() || null, partial: model.partial,
        }));
        this.message.set('Transcrição registrada. O áudio não foi enviado nem processado.');
        this.closeTranscript(); await this.load();
      } catch (error: unknown) {
        this.message.set(apiErrorMessage(error, 'Não foi possível registrar a transcrição.'));
      }
      return undefined;
    }});
  }
  protected async analyze(content: ContentItem): Promise<void> {
    const accountId = this.accounts.selectedId(); if (!accountId || this.analyzingIds().has(content.id)) return;
    this.analyzingIds.update((ids) => new Set(ids).add(content.id)); this.message.set(null);
    try {
      const updated = await firstValueFrom(this.service.analyze(accountId, content.id));
      this.contents.update((items) => items.map((item) => item.id === updated.id ? updated : item));
      this.message.set(updated.latestAnalysis?.simulated
        ? 'Análise simulada concluída.' : 'Análise de texto concluída com DeepSeek.');
    } catch (error: unknown) {
      this.message.set(apiErrorMessage(error, 'Não foi possível analisar este conteúdo.'));
    } finally {
      this.analyzingIds.update((ids) => { const next = new Set(ids); next.delete(content.id); return next; });
    }
  }
  protected typeLabel(type: ContentItem['contentType']): string {
    switch (type) { case 'SHORT_VIDEO': return 'Vídeo curto'; case 'IMAGE_POST': return 'Post de imagem';
      case 'TEXT_POST': return 'Post de texto'; case 'LIVE': return 'Live'; case 'ARTICLE': return 'Artigo';
      case 'CAROUSEL': return 'Carrossel'; case 'THREAD': return 'Thread'; case 'VIDEO': return 'Vídeo'; default: return 'Outro'; }
  }
  protected metric(value: number | null): string { return value === null ? 'Indisponível' : new Intl.NumberFormat('pt-BR').format(value); }
  protected retention(value: number | null): string { return value === null ? 'Indisponível' : `${Math.round(value * 100)}%`; }

  private async load(): Promise<void> {
    const accountId = this.accounts.selectedId(); this.message.set(null);
    if (!accountId) { this.contents.set([]); this.total.set(0); this.status.set('no-account'); return; }
    this.status.set('loading');
    try {
      const page = await firstValueFrom(this.service.list(accountId));
      this.contents.set(page.items); this.total.set(page.totalElements);
      this.status.set(page.items.length ? 'success' : 'empty');
    } catch (error: unknown) {
      this.contents.set([]); this.total.set(0); this.status.set('error');
      this.message.set(apiErrorMessage(error, 'Não foi possível carregar a memória de conteúdo.'));
    }
  }
}
