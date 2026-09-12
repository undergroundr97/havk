import { HttpErrorResponse } from '@angular/common/http';

import { isApiError } from './api-error.model';

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && isApiError(error.error)) {
    return error.error.message;
  }
  return fallback;
}
