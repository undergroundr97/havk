import { Component, input } from '@angular/core';

import { ReportSourceResponse } from '../../../reports/data-access/report.models';
import { formatReportDate } from '../../report-date';

@Component({
  selector: 'app-report-source-list',
  standalone: true,
  templateUrl: './report-source-list.html',
  styleUrl: './report-source-list.scss',
})
export class ReportSourceList {
  readonly sources = input.required<readonly ReportSourceResponse[]>();

  protected readonly formatDate = formatReportDate;

  protected isHttpReference(reference: string): boolean {
    try {
      const parsed = new URL(reference);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
