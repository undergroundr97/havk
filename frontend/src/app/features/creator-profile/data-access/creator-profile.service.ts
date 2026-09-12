import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api-config';
import { CreatorProfileRequest, CreatorProfileResponse } from './creator-profile.models';
import { ProfileReviewRequest, ProfileReviewResponse } from './profile-review.models';
import { PlatformAccountContextStore } from '../../platform-accounts/data-access/platform-account-context.store';

@Injectable({ providedIn: 'root' })
export class CreatorProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);
  private readonly accountContext = inject(PlatformAccountContextStore);

  getProfile(): Promise<CreatorProfileResponse> {
    return firstValueFrom(this.http.get<CreatorProfileResponse>(this.url));
  }

  saveProfile(request: CreatorProfileRequest): Promise<CreatorProfileResponse> {
    return firstValueFrom(this.http.put<CreatorProfileResponse>(this.url, request));
  }

  getReview(): Promise<ProfileReviewResponse> {
    return firstValueFrom(this.http.get<ProfileReviewResponse>(`${this.url}/review`));
  }

  saveReview(request: ProfileReviewRequest): Promise<ProfileReviewResponse> {
    return firstValueFrom(this.http.put<ProfileReviewResponse>(`${this.url}/review`, request));
  }

  private get url(): string {
    const accountId = this.accountContext.selectedId();
    return accountId
      ? `${this.apiConfig.baseUrl.replace(/\/$/, '')}/api/platform-accounts/${accountId}/profile`
      : `${this.apiConfig.baseUrl.replace(/\/$/, '')}/api/creator-profile`;
  }
}
