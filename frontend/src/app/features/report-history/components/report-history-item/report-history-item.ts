import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  ReportFinalStatus,
  ReportSummaryResponse,
} from '../../../reports/data-access/report.models';
import { formatReportDate } from '../../../report-viewer/report-date';

@Component({
  selector: 'app-report-history-item',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './report-history-item.html',
  styleUrl: './report-history-item.scss',
})
export class ReportHistoryItem {
  readonly report = input.required<ReportSummaryResponse>();
  readonly deleteRequested = output<void>();

  protected readonly formatDate = formatReportDate;

  protected statusLabel(status: ReportFinalStatus): string {
    switch (status) {
      case 'COMPLETED':
        return 'Concluído';
      case 'NO_RELEVANT_OPPORTUNITY':
        return 'Sem oportunidade relevante';
      case 'FAILED':
        return 'Falhou';
      case 'CANCELLED':
        return 'Cancelado';
    }
  }
}
