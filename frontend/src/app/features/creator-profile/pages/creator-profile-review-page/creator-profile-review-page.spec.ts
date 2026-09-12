import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { CreatorProfileService } from '../../data-access/creator-profile.service';
import { ProfileReviewResponse } from '../../data-access/profile-review.models';
import { CreatorProfileReviewPage } from './creator-profile-review-page';
import { PlatformAccountContextStore } from '../../../platform-accounts/data-access/platform-account-context.store';
import { platformAccountContextStub } from '../../../platform-accounts/testing/platform-account-context.stub';

describe('CreatorProfileReviewPage', () => {
  const getReview = vi.fn<() => Promise<ProfileReviewResponse>>();
  const saveReview = vi.fn(() => Promise.resolve(review));

  beforeEach(() => {
    getReview.mockReset();
    saveReview.mockClear();
    getReview.mockResolvedValue(review);
    TestBed.configureTestingModule({
      imports: [CreatorProfileReviewPage],
      providers: [
        provideRouter([]),
        { provide: CreatorProfileService, useValue: { getReview, saveReview } },
        { provide: PlatformAccountContextStore, useFactory: platformAccountContextStub },
      ],
    });
  });

  it('shows suggestion, textual confidence, evidence and simulated-data disclosure', async () => {
    const fixture = TestBed.createComponent(CreatorProfileReviewPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Tecnologia');
    expect(text).toContain('Confiança Alta');
    expect(text).toContain('Título e descrição do canal');
    expect(text).toContain('SIMULATED · Dados simulados');
  });

  it('edits a field and sends explicit, idempotent decisions', async () => {
    const fixture = TestBed.createComponent(CreatorProfileReviewPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLInputElement>('#review-primary-niche');
    if (!input) throw new Error('Review field not found');
    input.value = 'Educação';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.nativeElement.querySelector('form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(saveReview).toHaveBeenCalledWith(expect.objectContaining({
      inferenceId: review.inferenceId,
      idempotencyKey: expect.any(String),
      decisions: expect.arrayContaining([
        expect.objectContaining({ field: 'PRIMARY_NICHE', decision: 'REPLACE', values: ['Educação'] }),
      ]),
    }));
  });

  it('represents absence of an inference as an empty state', async () => {
    getReview.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    const fixture = TestBed.createComponent(CreatorProfileReviewPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sincronize o YouTube');
  });
});

const review: ProfileReviewResponse = {
  inferenceId: '00000000-0000-4000-8000-000000000014',
  inferenceVersion: 'fake-profile-v1',
  inferredAt: '2026-07-28T12:00:00Z',
  simulated: true,
  status: 'INFERRED_PENDING_REVIEW',
  confirmedRequiredFields: 0,
  totalRequiredFields: 4,
  remainingRequiredFields: 4,
  confirmedAt: null,
  hasNewSuggestions: false,
  fields: [{
    name: 'PRIMARY_NICHE', label: 'Nicho principal', required: true,
    suggestedValues: ['Tecnologia'], manualValues: [], confirmedValues: [], effectiveValues: ['Tecnologia'],
    effectiveSource: 'INFERRED', origin: 'YouTube', dataKind: 'INFERRED', confidence: 0.9,
    confidenceLabel: 'Alta', evidence: [{ type: 'CHANNEL', snapshotReference: 'snapshot-1', description: 'Título e descrição do canal' }],
    state: 'SUGGESTED', insufficientReason: null, newSuggestion: false,
  }],
};
