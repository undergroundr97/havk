import { Component } from '@angular/core';

import { CreatorProfileForm } from '../../components/creator-profile-form/creator-profile-form';
import { PlatformAccountSelector } from '../../../platform-accounts/components/platform-account-selector/platform-account-selector';

@Component({
  selector: 'app-creator-profile-onboarding-page',
  standalone: true,
  imports: [CreatorProfileForm, PlatformAccountSelector],
  template: '<div class="shell"><app-platform-account-selector /><app-creator-profile-form mode="onboarding" /></div>',
})
export class CreatorProfileOnboardingPage {}
