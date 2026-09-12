import { TestBed } from '@angular/core/testing';

import { ChannelHealth } from '../../data-access/dashboard.models';
import { ChannelHealthGrid } from './channel-health-grid';

describe('ChannelHealthGrid', () => {
  it('renders seven readable cards, criteria, confidence and simulated provenance', () => {
    const fixture = TestBed.createComponent(ChannelHealthGrid);
    fixture.componentRef.setInput('health', completeHealth());
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.health-card')).toHaveLength(7);
    expect(fixture.nativeElement.textContent).toContain('Saúde do canal');
    expect(fixture.nativeElement.textContent).toContain('SIMULATED · Dados simulados');
    expect(fixture.nativeElement.textContent).toContain('Confiança média');
    expect(fixture.nativeElement.textContent).toContain('Critério:');
  });

  it('identifies insufficient data in text instead of relying on color', () => {
    const health = completeHealth();
    const fixture = TestBed.createComponent(ChannelHealthGrid);
    fixture.componentRef.setInput('health', {
      ...health,
      status: 'PARTIAL',
      peakRetention: {
        value: null,
        explanation: 'O snapshot não possui retenção por vídeo suficiente.',
        criterion: 'Métrica persistida por vídeo',
        confidence: { score: 0, level: 'NONE' },
        insufficientData: true,
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dados insuficientes');
    expect(fixture.nativeElement.querySelector('.is-insufficient')).not.toBeNull();
  });

  it('renders explicit empty and error states', () => {
    const fixture = TestBed.createComponent(ChannelHealthGrid);
    fixture.componentRef.setInput('health', emptyHealth('EMPTY'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain('Ainda não há dados');

    fixture.componentRef.setInput('health', emptyHealth('ERROR'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível calcular');
  });
});

function completeHealth(): ChannelHealth {
  const insight = (value: string) => ({ value, explanation: 'Estimativa histórica; não é garantia.',
    criterion: 'Critério transparente', confidence: { score: .75, level: 'MEDIUM' as const }, insufficientData: false });
  return { status: 'SUCCESS', source: 'SIMULATED', simulated: true, analyzedAt: '2026-07-28T12:00:00Z',
    publicationFrequency: insight('1 vídeo por semana'), consistency: insight('Consistência excelente'),
    highestEngagement: insight('Rotina sustentável'), peakRetention: insight('78%'), bestDay: insight('Quarta-feira'),
    bestTime: insight('09h–11h'), bestFormat: insight('Vídeos longos') };
}

function emptyHealth(status: 'EMPTY' | 'ERROR'): ChannelHealth {
  return { status, source: null, simulated: false, analyzedAt: null, publicationFrequency: null, consistency: null,
    highestEngagement: null, peakRetention: null, bestDay: null, bestTime: null, bestFormat: null };
}
