import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { disabled, form, FormField, maxLength, required, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../../core/http/api-error-message';
import {
  EMPTY_PLATFORM_ACCOUNT_FORM, PlatformAccount, PlatformAccountFormModel, PlatformDefinition,
  toPlatformAccountRequest,
} from '../../data-access/platform-account.models';
import { PlatformAccountService } from '../../data-access/platform-account.service';
import { PlatformAccountContextStore } from '../../data-access/platform-account-context.store';

type ViewStatus = 'loading' | 'empty' | 'success' | 'error';

@Component({
  selector: 'app-platform-accounts-page', standalone: true, imports: [FormField, RouterLink],
  templateUrl: './platform-accounts-page.html', styleUrl: './platform-accounts-page.scss',
})
export class PlatformAccountsPage implements OnInit {
  private readonly service = inject(PlatformAccountService);
  private readonly context = inject(PlatformAccountContextStore);
  protected readonly status = signal<ViewStatus>('loading');
  protected readonly message = signal<string | null>(null);
  protected readonly accounts = signal<readonly PlatformAccount[]>([]);
  protected readonly platforms = signal<readonly PlatformDefinition[]>([]);
  protected readonly editingId = signal<string | null>(null);
  protected readonly archiveCandidate = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly model = signal<PlatformAccountFormModel>({ ...EMPTY_PLATFORM_ACCOUNT_FORM });
  protected readonly accountForm = form(this.model, (account) => {
    disabled(account.platformCode, () => this.editingId() !== null);
    required(account.platformCode, { message: 'Selecione a plataforma.' });
    required(account.displayName, { message: 'Informe o nome da conta.' });
    maxLength(account.displayName, 120); maxLength(account.handle, 120); maxLength(account.publicUrl, 2048);
    maxLength(account.description, 2000); maxLength(account.initialNiche, 120);
    validate(account.publicUrl, ({ value }) => urlError(value()));
  });
  protected readonly selectedDefinition = computed(() =>
    this.platforms().find((platform) => platform.code === this.model().platformCode) ?? null);

  async ngOnInit(): Promise<void> { await this.load(); }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.submitting()) return;
    await submit(this.accountForm, {
      onInvalid: () => this.message.set('Revise os campos destacados.'),
      action: async () => {
        this.submitting.set(true); this.message.set(null);
        try {
          const request = toPlatformAccountRequest(this.model());
          const id = this.editingId();
          if (id) await firstValueFrom(this.service.update(id, request));
          else await firstValueFrom(this.service.create(request));
          this.cancelEdit(); await this.load(); await this.context.load(true);
          this.message.set(id ? 'Conta atualizada.' : 'Conta cadastrada. Integrações indisponíveis não foram simuladas.');
        } catch (error: unknown) { this.message.set(apiErrorMessage(error, 'Não foi possível salvar a conta.')); }
        finally { this.submitting.set(false); }
        return undefined;
      },
    });
  }

  protected edit(account: PlatformAccount): void {
    if (account.archived) return;
    this.editingId.set(account.id);
    this.model.set({ platformCode: account.platformCode, displayName: account.displayName,
      handle: account.handle ?? '', externalIdentifier: account.externalIdentifier ?? '',
      publicUrl: account.publicUrl ?? '', description: account.description ?? '', language: account.language ?? '',
      region: account.region ?? '', initialNiche: '' });
  }

  protected cancelEdit(): void { this.editingId.set(null); this.model.set({ ...EMPTY_PLATFORM_ACCOUNT_FORM }); }
  protected requestArchive(id: string): void { this.archiveCandidate.set(id); }
  protected cancelArchive(): void { this.archiveCandidate.set(null); }
  protected async archive(id: string): Promise<void> {
    try { await firstValueFrom(this.service.archive(id)); this.archiveCandidate.set(null); await this.load(); await this.context.load(true); }
    catch (error: unknown) { this.message.set(apiErrorMessage(error, 'Não foi possível arquivar a conta.')); }
  }
  protected profileLabel(account: PlatformAccount): string { return account.profileConfigured ? 'Perfil configurado' : 'Perfil pendente'; }
  protected healthLabel(account: PlatformAccount): string {
    if (account.healthAvailability === 'AVAILABLE') return 'Saúde disponível';
    if (account.healthAvailability === 'INTEGRATION_UNAVAILABLE') return 'Integração não disponível';
    return 'Dados insuficientes';
  }
  protected originLabel(account: PlatformAccount): string {
    return account.dataOrigin === 'SIMULATED' ? 'SIMULATED · Dados simulados'
      : account.dataOrigin === 'MANUAL' ? 'Cadastro manual' : 'Integração autorizada';
  }
  protected dateLabel(value: string | null): string {
    return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Nunca';
  }

  private async load(): Promise<void> {
    this.status.set('loading');
    try {
      const [accounts, platforms] = await Promise.all([
        firstValueFrom(this.service.list(true)), firstValueFrom(this.service.platforms()),
      ]);
      this.accounts.set(accounts); this.platforms.set(platforms);
      this.status.set(accounts.length ? 'success' : 'empty');
    } catch (error: unknown) { this.status.set('error'); this.message.set(apiErrorMessage(error, 'Não foi possível carregar as contas.')); }
  }
}

function urlError(value: string): { readonly kind: string; readonly message: string } | null {
  if (!value.trim()) return null;
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:' ? null
    : { kind: 'url', message: 'Use uma URL http ou https.' }; }
  catch { return { kind: 'url', message: 'Informe uma URL pública válida.' }; }
}
