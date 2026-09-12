import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { ApiError, isApiError } from './api-error.model';

export const httpErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || isApiError(error.error)) {
        return throwError(() => error);
      }

      const normalizedError: ApiError = {
        code: error.status === 0 ? 'NETWORK_ERROR' : 'HTTP_ERROR',
        message:
          error.status === 0
            ? 'Não foi possível conectar ao serviço.'
            : 'O serviço não conseguiu concluir a solicitação.',
        status: error.status,
        timestamp: new Date().toISOString(),
        path: request.urlWithParams,
        details: [],
      };

      return throwError(
        () =>
          new HttpErrorResponse({
            error: normalizedError,
            headers: error.headers,
            status: error.status,
            statusText: error.statusText,
            url: error.url ?? request.urlWithParams,
          }),
      );
    }),
  );
