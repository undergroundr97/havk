import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { safeInternalReturnUrl } from '../../../../core/auth/safe-return-url';

@Component({
  selector: 'app-oauth-callback-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './oauth-callback-page.html',
  styleUrl: './oauth-callback-page.scss',
})
export class OAuthCallbackPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly message = signal('Confirmando a autorização com segurança…');
  protected readonly failed = signal(false);
  protected readonly retryUrl = signal('/login');

  async ngOnInit(): Promise<void> {
    const status = this.route.snapshot.queryParamMap.get('status');
    const error = this.route.snapshot.queryParamMap.get('error');
    const destination = safeInternalReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    this.retryUrl.set(`/login?returnUrl=${encodeURIComponent(destination)}`);
    if (status === 'error' || error) {
      this.fail(errorMessage(error ?? 'OAUTH_CALLBACK_FAILED'));
      return;
    }
    if (status !== 'success') {
      this.fail('O retorno da autorização não é válido. Inicie a conexão novamente.');
      return;
    }
    if (!(await this.auth.restoreOAuthSession())) {
      this.fail('A autorização foi concluída, mas a sessão HAVK não ficou disponível. Tente entrar novamente.');
      return;
    }
    await this.router.navigateByUrl(destination);
  }

  private fail(message: string): void {
    this.failed.set(true);
    this.message.set(message);
  }
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    OAUTH_ACCOUNT_LINK_REQUIRED: 'Este e-mail já possui uma conta HAVK. Entre com sua senha e conecte o YouTube pela área do canal.',
    GOOGLE_IDENTITY_ALREADY_LINKED: 'Esta identidade Google já está vinculada a outra conta.',
    YOUTUBE_CHANNEL_ALREADY_LINKED: 'Este canal já está vinculado a outra conta HAVK.',
    OAUTH_AUTHORIZATION_DENIED: 'A autorização foi cancelada. Nenhuma conexão foi criada.',
    OAUTH_STATE_EXPIRED: 'A autorização expirou. Inicie o processo novamente.',
    OAUTH_REPLAY_DETECTED: 'Esta autorização já foi utilizada.',
    OAUTH_ACCESS_TOKEN_MISSING: 'O Google não retornou a credencial necessária. Inicie a autorização novamente.',
    OAUTH_ID_TOKEN_MISSING: 'O Google não retornou a identidade necessária. Inicie a autorização novamente.',
    OAUTH_ID_TOKEN_INVALID: 'Não foi possível validar com segurança a identidade retornada pelo Google.',
    OAUTH_ID_TOKEN_NONCE_MISSING: 'A resposta do Google não pertence a uma autorização válida. Tente novamente.',
    INVALID_OAUTH_NONCE: 'A resposta do Google não pertence a esta autorização. Tente novamente.',
    OAUTH_TOKEN_SCOPE_MISSING: 'O Google não informou as permissões concedidas. Autorize novamente.',
    OAUTH_INSUFFICIENT_SCOPE: 'As permissões necessárias do YouTube não foram concedidas.',
    YOUTUBE_CHANNEL_NOT_FOUND: 'A conta selecionada não possui um canal principal do YouTube.',
    YOUTUBE_ACCESS_DENIED: 'O YouTube recusou a consulta do canal. Confirme as permissões e tente novamente.',
    OAUTH_TOKEN_EXCHANGE_REJECTED: 'O Google recusou a conclusão da autorização. Inicie o processo novamente.',
    OAUTH_CLIENT_AUTHENTICATION_FAILED: 'A configuração local do Google OAuth foi recusada pelo provedor.',
    YOUTUBE_PROVIDER_TIMEOUT: 'O Google demorou demais para responder. Tente novamente em instantes.',
    YOUTUBE_TEMPORARY_ERROR: 'O Google está temporariamente indisponível. Tente novamente em instantes.',
  };
  return messages[code] ?? 'Não foi possível concluir a autorização. Tente novamente.';
}
