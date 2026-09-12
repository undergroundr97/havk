import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_CONFIG } from '../../../core/config/api-config';
import { CreatorProfileRequest, CreatorProfileResponse } from './creator-profile.models';
import { CreatorProfileService } from './creator-profile.service';
import { ProfileReviewRequest, ProfileReviewResponse } from './profile-review.models';

describe('CreatorProfileService', () => {
  let service: CreatorProfileService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: 'http://api.test/' } },
      ],
    });
    service = TestBed.inject(CreatorProfileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the authenticated creator profile', async () => {
    const promise = service.getProfile();
    http.expectOne('http://api.test/api/creator-profile').flush(profile);

    await expect(promise).resolves.toEqual(profile);
  });

  it('creates or updates the profile through PUT', async () => {
    const request: CreatorProfileRequest = {
      primaryNiche: 'Tecnologia',
      subNiches: ['IA'],
      targetAudience: 'Criadores',
      language: 'Português',
      targetRegion: null,
      communicationStyle: null,
      channelGoals: ['Ensinar'],
      preferredTopics: [],
      excludedTopics: [],
      experienceLevel: null,
      publicationFrequency: null,
    };
    const promise = service.saveProfile(request);
    const pending = http.expectOne('http://api.test/api/creator-profile');

    expect(pending.request.method).toBe('PUT');
    expect(pending.request.body).toEqual(request);
    pending.flush(profile);
    await expect(promise).resolves.toEqual(profile);
  });

  it('loads and saves the field-by-field review through dedicated endpoints', async () => {
    const getPromise = service.getReview();
    http.expectOne('http://api.test/api/creator-profile/review').flush(review);
    await expect(getPromise).resolves.toEqual(review);

    const request: ProfileReviewRequest = {
      inferenceId: review.inferenceId,
      idempotencyKey: '00000000-0000-4000-8000-000000000015',
      decisions: [{ field: 'PRIMARY_NICHE', decision: 'ACCEPT_SUGGESTION', values: ['Tecnologia'] }],
    };
    const savePromise = service.saveReview(request);
    const pending = http.expectOne('http://api.test/api/creator-profile/review');
    expect(pending.request.method).toBe('PUT');
    expect(pending.request.body).toEqual(request);
    pending.flush(review);
    await expect(savePromise).resolves.toEqual(review);
  });
});

const profile: CreatorProfileResponse = {
  id: 'profile-1',
  primaryNiche: 'Tecnologia',
  subNiches: ['IA'],
  targetAudience: 'Criadores',
  language: 'Português',
  channelGoals: ['Ensinar'],
  preferredTopics: [],
  excludedTopics: [],
  createdAt: '2026-07-22T12:00:00Z',
  updatedAt: '2026-07-22T12:00:00Z',
};

const review: ProfileReviewResponse = {
  inferenceId: '00000000-0000-4000-8000-000000000014',
  inferenceVersion: 'fake-v1',
  inferredAt: '2026-07-28T12:00:00Z',
  simulated: true,
  status: 'INFERRED_PENDING_REVIEW',
  confirmedRequiredFields: 0,
  totalRequiredFields: 4,
  remainingRequiredFields: 4,
  confirmedAt: null,
  hasNewSuggestions: false,
  fields: [],
};
