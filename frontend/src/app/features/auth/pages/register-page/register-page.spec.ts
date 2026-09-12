import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../../../core/auth/auth.service';
import { RegisterPage } from './register-page';

describe('RegisterPage', () => {
  const register = vi.fn(() => Promise.resolve({}));

  beforeEach(() => {
    register.mockClear();
    TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: { register } }],
    });
  });

  it('shows accessible validation messages and does not submit invalid data', async () => {
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    submit(fixture.nativeElement as HTMLElement);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(register).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Informe seu nome.');
    expect(fixture.nativeElement.textContent).toContain('Informe seu e-mail.');
    expect(fixture.nativeElement.textContent).toContain('Crie uma senha.');
  });

  it('validates password confirmation and redirects after a valid registration', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    fill(fixture.nativeElement as HTMLElement, '#register-name', 'Criadora HAVK');
    fill(fixture.nativeElement as HTMLElement, '#register-email', 'creator@example.com');
    fill(fixture.nativeElement as HTMLElement, '#register-password', 'long-secure-password');
    fill(fixture.nativeElement as HTMLElement, '#register-confirm-password', 'different-password');
    submit(fixture.nativeElement as HTMLElement);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(register).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('As senhas precisam ser iguais.');

    fill(fixture.nativeElement as HTMLElement, '#register-confirm-password', 'long-secure-password');
    submit(fixture.nativeElement as HTMLElement);
    await fixture.whenStable();
    expect(register).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { registered: 'true' } });
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
