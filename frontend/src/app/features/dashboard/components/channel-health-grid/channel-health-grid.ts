import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

import { ChannelHealth, ChannelHealthInsight } from '../../data-access/dashboard.models';

interface HealthCard {
  readonly key: string;
  readonly title: string;
  readonly insight: ChannelHealthInsight;
}

@Component({
  selector: 'app-channel-health-grid',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './channel-health-grid.html',
  styleUrl: './channel-health-grid.scss',
})
export class ChannelHealthGrid {
  readonly health = input.required<ChannelHealth>();

  protected readonly cards = computed<readonly HealthCard[]>(() => {
    const health = this.health();
    return [
      card('frequency', 'Frequência de publicação', health.publicationFrequency),
      card('consistency', 'Consistência', health.consistency),
      card('engagement', 'Maior engajamento', health.highestEngagement),
      card('retention', 'Pico de retenção', health.peakRetention),
      card('day', 'Melhor dia para postar', health.bestDay),
      card('time', 'Melhor horário para postar', health.bestTime),
      card('format', 'Melhor tipo de vídeo', health.bestFormat),
    ].filter((item): item is HealthCard => item !== null);
  });

  protected confidenceLabel(level: ChannelHealthInsight['confidence']['level']): string {
    switch (level) {
      case 'HIGH': return 'Confiança alta';
      case 'MEDIUM': return 'Confiança média';
      case 'LOW': return 'Confiança baixa';
      case 'NONE': return 'Sem confiança calculável';
    }
  }
}

function card(key: string, title: string, insight: ChannelHealthInsight | null): HealthCard | null {
  return insight === null ? null : { key, title, insight };
}

