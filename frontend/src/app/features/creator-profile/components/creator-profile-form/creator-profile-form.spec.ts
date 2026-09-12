import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { CreatorProfileResponse } from '../../data-access/creator-profile.models';
import { CreatorProfileService } from '../../data-access/creator-profile.service';
import { CreatorProfileForm } from './creator-profile-form';

describe('CreatorProfileForm', () => {
  const getProfile = vi.fn<() => Promise<CreatorProfileResponse>>();
  const saveProfile = vi.fn(() => Promise.resolve(profile));

  beforeEach(() => {
    getProfile.mockReset();
    saveProfile.mockClear();
    getProfile.mockResolvedValue(profile);
    TestBed.configureTestingModule({
      imports: [CreatorProfileForm],
      providers: [
        provideRouter([]),
        { provide: CreatorProfileService, useValue: { getProfile, saveProfile } },
      ],
    });
  });

  it('represents loading and loads an existing profile', async () => {
    let resolveProfile: ((value: CreatorProfileResponse) => void) | undefined;
    getProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    const fixture = createFixture();

    expect(fixture.nativeElement.textContent).toContain('Carregando seu perfil');
    resolveProfile?.(profile);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(inputValue(fixture.nativeElement, '#profile-primary-niche')).toBe('Tecnologia');
    expect(fixture.nativeElement.textContent).toContain('100%');
  });

  it('represents an absent profile as an empty onboarding state', async () => {
    getProfile.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Seu perfil ainda não foi criado');
    expect(inputValue(fixture.nativeElement, '#profile-primary-niche')).toBe('');
  });

  it('validates required form fields before submission', async () => {
    getProfile.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    const fixture = createFixture();
    await fixture.whenStable();
    submitForm(fixture.nativeElement);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(saveProfile).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Informe o nicho principal.');
    expect(fixture.nativeElement.textContent).toContain('Informe o público-alvo.');
    expect(fixture.nativeElement.textContent).toContain('Informe o idioma.');
    expect(fixture.nativeElement.textContent).toContain('Informe ao menos um objetivo do canal.');
  });

  it('submits a valid onboarding model converted explicitly to the API request', async () => {
    getProfile.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    const fixture = createFixture();
    await fixture.whenStable();
    fillRequiredFields(fixture.nativeElement);
    fill(fixture.nativeElement, '#profile-sub-niches', 'IA\nIA\nProdutividade');
    submitForm(fixture.nativeElement);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        primaryNiche: 'Tecnologia',
        subNiches: ['IA', 'Produtividade'],
        targetAudience: 'Criadores iniciantes',
        language: 'Português',
        channelGoals: ['Ensinar', 'Aumentar alcance'],
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('Perfil salvo com sucesso.');
  });

  it('updates a loaded profile through the same PUT service operation', async () => {
    const fixture = createFixture('edit');
    await fixture.whenStable();
    fill(fixture.nativeElement, '#profile-primary-niche', 'Educação');
    submitForm(fixture.nativeElement);
    await fixture.whenStable();

    expect(saveProfile).toHaveBeenCalledWith(expect.objectContaining({ primaryNiche: 'Educação' }));
  });

  it('shows a comprehensible API error', async () => {
    saveProfile.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 400,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Os dados enviados são inválidos.',
          status: 400,
          timestamp: '2026-07-22T12:00:00Z',
          path: '/api/creator-profile',
          details: [],
        },
      }),
    );
    const fixture = createFixture();
    await fixture.whenStable();
    submitForm(fixture.nativeElement);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Os dados enviados são inválidos.');
  });

  it('prevents duplicate submissions and represents saving and success states', async () => {
    let resolveSave: ((value: CreatorProfileResponse) => void) | undefined;
    saveProfile.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const fixture = createFixture();
    await fixture.whenStable();
    submitForm(fixture.nativeElement);
    submitForm(fixture.nativeElement);
    await Promise.resolve();
    fixture.detectChanges();

    expect(saveProfile).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Salvando');
    const submitButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    expect(submitButton?.disabled).toBe(true);

    resolveSave?.(profile);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Perfil salvo com sucesso.');
  });

  function createFixture(mode: 'onboarding' | 'edit' = 'onboarding') {
    const fixture = TestBed.createComponent(CreatorProfileForm);
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
    return fixture;
  }
});

const profile: CreatorProfileResponse = {
  id: 'profile-1',
  primaryNiche: 'Tecnologia',
  subNiches: ['IA'],
  targetAudience: 'Criadores iniciantes',
  language: 'Português',
  targetRegion: 'Brasil',
  communicationStyle: 'Didático',
  channelGoals: ['Ensinar'],
  preferredTopics: ['Ferramentas'],
  excludedTopics: ['Boatos'],
  experienceLevel: 'Intermediário',
  publicationFrequency: 'Semanal',
  createdAt: '2026-07-22T12:00:00Z',
  updatedAt: '2026-07-22T12:00:00Z',
};

function fillRequiredFields(element: HTMLElement): void {
  fill(element, '#profile-primary-niche', 'Tecnologia');
  fill(element, '#profile-target-audience', 'Criadores iniciantes');
  fill(element, '#profile-language', 'Português');
  fill(element, '#profile-channel-goals', 'Ensinar\nAumentar alcance');
}

function fill(element: HTMLElement, selector: string, value: string): void {
  const control = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!control) throw new Error(`Control not found: ${selector}`);
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
}

function inputValue(element: HTMLElement, selector: string): string {
  const control = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!control) throw new Error(`Control not found: ${selector}`);
  return control.value;
}

function submitForm(element: HTMLElement): void {
  element.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
