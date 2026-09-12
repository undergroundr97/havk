import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_CONFIG } from '../../../core/config/api-config';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('loads the session dashboard without sending a user identifier', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: 'http://localhost:8080/' } },
      ],
    });
    const service = TestBed.inject(DashboardService);
    const http = TestBed.inject(HttpTestingController);
    let receivedName: string | null | undefined;

    service.getDashboard().subscribe((dashboard) => (receivedName = dashboard.user.name));
    const request = http.expectOne('http://localhost:8080/api/dashboard');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    request.flush(emptyDashboard());

    expect(receivedName).toBe('Criadora HAVK');
    http.verify();
  });
});

function emptyDashboard() {
  return {
    user: { name: 'Criadora HAVK' },
    onboarding: {
      accountCreated: true,
      profileConfigured: false,
      channelRegistered: false,
      firstReportGenerated: false,
      channel: null,
    },
    reports: { totalReports: 0, totalIdeas: 0, lastGeneratedAt: null },
    recentReports: [],
    activeRequest: null,
    recommendedAction: {
      type: 'CONFIGURE_PROFILE',
      title: 'Complete seu perfil',
      description: 'Informe seu contexto.',
      target: '/perfil/onboarding',
    },
    youtube: null,
    channelHealth: { status: 'EMPTY', source: null, simulated: false, analyzedAt: null, publicationFrequency: null,
      consistency: null, highestEngagement: null, peakRetention: null, bestDay: null, bestTime: null, bestFormat: null },
  };
}
