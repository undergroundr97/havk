import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../../../core/auth/auth.service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  const login = vi.fn(() => Promise.resolve({}));

  beforeEach(() => {
    login.mockClear();
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: { login } }],
    });
  });

  it('validates e-mail and password before submission', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    submit(fixture.nativeElement as HTMLElement);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(login).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Informe seu e-mail.');
    expect(fixture.nativeElement.textContent).toContain('Informe sua senha.');
    expect(fixture.nativeElement.textContent).toContain('Entrar com YouTube');
  });

  it('prevents duplicate submissions and redirects to the private destination', async () => {
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    let resolveLogin: (() => void) | undefined;
    login.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = () => resolve({});
        }),
    );
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    fill(fixture.nativeElement as HTMLElement, '#login-email', 'creator@example.com');
    fill(fixture.nativeElement as HTMLElement, '#login-password', 'long-secure-password');
    submit(fixture.nativeElement as HTMLElement);
    submit(fixture.nativeElement as HTMLElement);
    await Promise.resolve();

    expect(login).toHaveBeenCalledTimes(1);
    resolveLogin?.();
    await fixture.whenStable();
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });
});

function fill(element: HTMLElement, selector: string, value: string): void {
  const input = element.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`Input not found: ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function submit(element: HTMLElement): void {
  element.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
