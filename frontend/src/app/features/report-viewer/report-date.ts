const REPORT_DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatReportDate(value: string): string {
  return REPORT_DATE_FORMAT.format(new Date(value));
}
