export interface ApiErrorDetail {
  readonly field: string;
  readonly message: string;
}

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly status: number;
  readonly timestamp: string;
  readonly path: string;
  readonly details: readonly ApiErrorDetail[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiErrorDetail(value: unknown): value is ApiErrorDetail {
  return (
    isRecord(value) && typeof value['field'] === 'string' && typeof value['message'] === 'string'
  );
}

export function isApiError(value: unknown): value is ApiError {
  return (
    isRecord(value) &&
    typeof value['code'] === 'string' &&
    typeof value['message'] === 'string' &&
    typeof value['status'] === 'number' &&
    typeof value['timestamp'] === 'string' &&
    typeof value['path'] === 'string' &&
    Array.isArray(value['details']) &&
    value['details'].every(isApiErrorDetail)
  );
}
