import { convertToParamMap } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../../../core/auth/auth.service';
import { OAuthCallbackPage } from './oauth-callback-page';

describe('OAuthCallbackPage', () => {
  const restoreOAuthSession = vi.fn<() => Promise<boolean>>();
  const navigateByUrl = vi.fn<(url: string) => Promise<boolean>>();

  beforeEach(() => {
    restoreOAuthSession.mockReset().mockResolvedValue(true);
    navigateByUrl.mockReset().mockResolvedValue(true);
  });

  it('restores the normal HAVK session and accepts only an internal return URL', async () => {
    const fixture = createFixture({ status: 'success', returnUrl: '/canal' });
    await fixture.whenStable();
    expect(restoreOAuthSession).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith('/canal');
  });

  it('falls back to the dashboard for an external return URL', async () => {
    const fixture = createFixture({ status: 'success', returnUrl: 'https://attacker.example' });
    await fixture.whenStable();
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('shows a safe actionable account-link conflict without restoring a session', async () => {
    const fixture = createFixture({ status: 'error', error: 'OAUTH_ACCOUNT_LINK_REQUIRED' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Entre com sua senha');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(restoreOAuthSession).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not navigate when the OAuth session is still unavailable after bounded retries', async () => {
    restoreOAuthSession.mockResolvedValue(false);
    const fixture = createFixture({ status: 'success', returnUrl: '/dashboard' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('sessão HAVK não ficou disponível');
    expect(fixture.nativeElement.textContent).toContain('Tentar novamente');
  });

  it('rejects a callback without an explicit success status', async () => {
    const fixture = createFixture({ returnUrl: '/dashboard' });
    await fixture.whenStable();

    expect(restoreOAuthSession).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  function createFixture(query: Record<string, string>) {
    TestBed.configureTestingModule({
      imports: [OAuthCallbackPage],
      providers: [
        { provide: AuthService, useValue: { restoreOAuthSession } },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    const fixture = TestBed.createComponent(OAuthCallbackPage);
    fixture.detectChanges();
    return fixture;
  }
});
