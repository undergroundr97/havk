import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../../../core/auth/auth.service';
import { AuthenticatedUser } from '../../../../core/auth/auth.models';
import { AuthSessionStore } from '../../../../core/auth/auth-session.store';
import { AccountPage } from './account-page';

describe('AccountPage', () => {
  const logout = vi.fn(() => Promise.resolve());
  const user: AuthenticatedUser = {
    id: 'user-1',
    name: 'Criadora HAVK',
    email: 'creator@example.com',
    status: 'ACTIVE',
    createdAt: '2026-07-22T12:00:00Z',
    updatedAt: '2026-07-22T12:00:00Z',
  };

  beforeEach(() => {
    logout.mockClear();
    TestBed.configureTestingModule({
      imports: [AccountPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: { logout } }],
    });
    TestBed.inject(AuthSessionStore).authenticated(user);
  });

  it('shows the backend identity and redirects home after logout', async () => {
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Criadora HAVK');
    expect(fixture.nativeElement.textContent).toContain('creator@example.com');
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });
});
