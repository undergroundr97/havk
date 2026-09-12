import { HttpErrorResponse } from '@angular/common/http';

import { isApiError } from '../../../core/http/api-error.model';

export type ReportDeletionErrorKind =
  | 'already-absent'
  | 'session'
  | 'forbidden'
  | 'csrf'
  | 'network'
  | 'unknown';

export interface ReportDeletionFailure {
  readonly kind: ReportDeletionErrorKind;
  readonly message: string;
  readonly canRetry: boolean;
}

export function reportDeletionFailure(error: unknown): ReportDeletionFailure {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 404) {
      return {
        kind: 'already-absent',
        message: 'O relatório já não estava disponível e foi removido da interface.',
        canRetry: false,
      };
    }
    if (error.status === 401) {
      return {
        kind: 'session',
        message: 'Sua sessão expirou. Entre novamente para continuar.',
        canRetry: false,
      };
    }
    if (error.status === 403 && isApiError(error.error) && error.error.code === 'INVALID_CSRF_TOKEN') {
      return {
        kind: 'csrf',
        message: 'A confirmação de segurança expirou. Tente excluir novamente.',
        canRetry: true,
      };
    }
    if (error.status === 403) {
      return {
        kind: 'forbidden',
        message: 'A exclusão não foi autorizada. O relatório foi mantido.',
        canRetry: false,
      };
    }
    if (error.status === 0 || (isApiError(error.error) && error.error.code === 'NETWORK_ERROR')) {
      return {
        kind: 'network',
        message: 'Não foi possível conectar ao serviço. O relatório foi mantido.',
        canRetry: true,
      };
    }
  }

  return {
    kind: 'unknown',
    message: 'Não foi possível excluir o relatório. Ele foi mantido.',
    canRetry: true,
  };
}
