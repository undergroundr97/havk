import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { ReportSummaryResponse } from '../../../reports/data-access/report.models';
import { ReportHistoryItem } from './report-history-item';

describe('ReportHistoryItem', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReportHistoryItem],
      providers: [provideRouter([])],
    });
  });

  it('renders every history metadata field and links to the authorized detail route', () => {
    const fixture = TestBed.createComponent(ReportHistoryItem);
    fixture.componentRef.setInput('report', reportSummary);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent;
    const link = host.querySelector<HTMLAnchorElement>('h2 a');
    const times = host.querySelectorAll<HTMLTimeElement>('time');

    expect(text).toContain('Relatório pronto');
    expect(text).toContain('Resumo acionável.');
    expect(text).toContain('Canal HAVK');
    expect(text).toContain('Angular Signals');
    expect(text).toContain('2');
    expect(text).toContain('Concluído');
    expect(link?.getAttribute('href')).toBe(`/relatorios/${REPORT_ID}`);
    expect(times).toHaveLength(2);
    expect(times[0]?.dateTime).toBe(reportSummary.generatedAt);
    expect(times[1]?.dateTime).toBe(reportSummary.createdAt);
  });

  it('uses neutral copy when the requested topic is absent', () => {
    const fixture = TestBed.createComponent(ReportHistoryItem);
    fixture.componentRef.setInput('report', { ...reportSummary, requestedTopic: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Não informado');
    expect(fixture.nativeElement.querySelector('article[aria-labelledby]')).not.toBeNull();
  });

  it('emits a deletion request only from its explicit native button', () => {
    const fixture = TestBed.createComponent(ReportHistoryItem);
    const requested = vi.fn();
    fixture.componentInstance.deleteRequested.subscribe(requested);
    fixture.componentRef.setInput('report', reportSummary);
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.delete-action',
    );
    expect(button?.type).toBe('button');
    button?.click();
    expect(requested).toHaveBeenCalledOnce();
  });
});

const REPORT_ID = '00000000-0000-4000-8000-000000000001';

const reportSummary: ReportSummaryResponse = {
  id: REPORT_ID,
  requestId: '00000000-0000-4000-8000-000000000002',
  platformAccountId: '00000000-0000-4000-8000-000000000003',
  platformCode: 'YOUTUBE',
  platformHandle: '@havk',
  channelId: '00000000-0000-4000-8000-000000000003',
  title: 'Relatório pronto',
  summary: 'Resumo acionável.',
  generatedAt: '2026-07-22T12:05:00Z',
  createdAt: '2026-07-22T12:05:01Z',
  channelName: 'Canal HAVK',
  requestedTopic: 'Angular Signals',
  requestedIdeaCount: 2,
  status: 'COMPLETED',
};
