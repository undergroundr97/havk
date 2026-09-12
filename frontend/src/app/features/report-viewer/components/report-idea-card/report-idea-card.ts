import { Component, computed, input } from '@angular/core';

import {
  ReportSourceResponse,
  VideoIdeaResponse,
} from '../../../reports/data-access/report.models';
import { ReportSourceList } from '../report-source-list/report-source-list';

@Component({
  selector: 'app-report-idea-card',
  standalone: true,
  imports: [ReportSourceList],
  templateUrl: './report-idea-card.html',
  styleUrl: './report-idea-card.scss',
})
export class ReportIdeaCard {
  readonly idea = input.required<VideoIdeaResponse>();
  readonly displayNumber = input.required<number>();
  readonly sources = input<readonly ReportSourceResponse[]>([]);

  protected readonly headingId = computed(() => `report-idea-${this.idea().id}`);
}
