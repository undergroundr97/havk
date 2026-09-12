import { Routes } from '@angular/router';
import { authenticatedGuard, authenticatedUserRedirectGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/public-layout/public-layout').then(({ PublicLayout }) => PublicLayout),
    children: [
      {
        path: '',
        title: 'HAVK — Ideias guiadas por tendências',
        loadComponent: () =>
          import('./features/home/pages/home-page/home-page').then(({ HomePage }) => HomePage),
      },
      {
        path: 'cadastro',
        title: 'Criar conta — HAVK',
        loadComponent: () =>
          import('./features/auth/pages/register-page/register-page').then(
            ({ RegisterPage }) => RegisterPage,
          ),
      },
      {
        path: 'login',
        canActivate: [authenticatedUserRedirectGuard],
        title: 'Entrar — HAVK',
        loadComponent: () =>
          import('./features/auth/pages/login-page/login-page').then(({ LoginPage }) => LoginPage),
      },
      {
        path: 'oauth/callback',
        title: 'Conectando YouTube — HAVK',
        loadComponent: () => import('./features/auth/pages/oauth-callback-page/oauth-callback-page').then(
          ({ OAuthCallbackPage }) => OAuthCallbackPage,
        ),
      },
      {
        path: 'erro',
        title: 'Página não encontrada — HAVK',
        loadComponent: () =>
          import('./features/error/pages/error-page/error-page').then(({ ErrorPage }) => ErrorPage),
      },
    ],
  },
  {
    path: '',
    canActivateChild: [authenticatedGuard],
    loadComponent: () =>
      import('./core/layout/main-layout/main-layout').then(({ MainLayout }) => MainLayout),
    children: [
      {
        path: 'dashboard',
        title: 'Visão geral — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard-page/dashboard-page').then(
            ({ DashboardPage }) => DashboardPage,
          ),
      },
      {
        path: 'contas-de-plataforma',
        title: 'Contas de plataforma — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () => import('./features/platform-accounts/pages/platform-accounts-page/platform-accounts-page')
          .then(({ PlatformAccountsPage }) => PlatformAccountsPage),
      },
      {
        path: 'conta',
        title: 'Sua conta — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./features/auth/pages/account-page/account-page').then(
            ({ AccountPage }) => AccountPage,
          ),
      },
      {
        path: 'perfil/onboarding',
        title: 'Configure seu perfil — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import(
            './features/creator-profile/pages/creator-profile-onboarding-page/creator-profile-onboarding-page'
          ).then(({ CreatorProfileOnboardingPage }) => CreatorProfileOnboardingPage),
      },
      {
        path: 'perfil/revisao',
        title: 'Revisar perfil automático — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import(
            './features/creator-profile/pages/creator-profile-review-page/creator-profile-review-page'
          ).then(({ CreatorProfileReviewPage }) => CreatorProfileReviewPage),
      },
      {
        path: 'perfil',
        title: 'Editar perfil — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import(
            './features/creator-profile/pages/creator-profile-edit-page/creator-profile-edit-page'
          ).then(({ CreatorProfileEditPage }) => CreatorProfileEditPage),
      },
      {
        path: 'canal',
        title: 'Seu canal — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./features/channels/pages/channel-summary-page/channel-summary-page').then(
            ({ ChannelSummaryPage }) => ChannelSummaryPage,
          ),
      },
      {
        path: 'canal/novo',
        title: 'Cadastrar canal — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./features/channels/pages/channel-create-page/channel-create-page').then(
            ({ ChannelCreatePage }) => ChannelCreatePage,
          ),
      },
      {
        path: 'canal/editar',
        title: 'Editar canal — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./features/channels/pages/channel-edit-page/channel-edit-page').then(
            ({ ChannelEditPage }) => ChannelEditPage,
          ),
      },
      {
        path: 'tendencias',
        title: 'Tendências confiáveis — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () => import('./features/trends/pages/trends-page/trends-page')
          .then(({ TrendsPage }) => TrendsPage),
      },
      {
        path: 'memoria-de-conteudo',
        title: 'Memória de conteúdo — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () => import('./features/content-memory/pages/content-memory-page/content-memory-page')
          .then(({ ContentMemoryPage }) => ContentMemoryPage),
      },
      {
        path: 'workspace',
        title: 'Workspace editorial — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./features/workspace/pages/workspace-page/workspace-page').then(
            ({ WorkspacePage }) => WorkspacePage,
          ),
      },
      {
        path: 'workspace/:conversationId',
        title: 'Conversa editorial — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./features/workspace/pages/workspace-page/workspace-page').then(
            ({ WorkspacePage }) => WorkspacePage,
          ),
      },
      {
        path: 'relatorios/novo',
        title: 'Gerar relatório — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import(
            './features/report-generation/pages/report-generation-page/report-generation-page'
          ).then(({ ReportGenerationPage }) => ReportGenerationPage),
      },
      {
        path: 'relatorios',
        title: 'Histórico de relatórios — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./features/report-history/pages/report-history-page/report-history-page').then(
            ({ ReportHistoryPage }) => ReportHistoryPage,
          ),
      },
      {
        path: 'relatorios/:reportId',
        title: 'Detalhe do relatório — HAVK',
        canActivate: [authenticatedGuard],
        loadComponent: () =>
          import('./features/report-viewer/pages/report-detail-page/report-detail-page').then(
            ({ ReportDetailPage }) => ReportDetailPage,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'erro',
  },
];
