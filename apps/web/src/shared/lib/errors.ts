import { strings } from '../strings/id';

export type AppError = {
  code: string;
  message: string;
  retryable: boolean;
  raw?: unknown;
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

function readMessage(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return null;
  }
  return typeof error.message === 'string' ? error.message : null;
}

export function toAppError(error: unknown): AppError {
  const message = readMessage(error);
  const codeFromField =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : null;
  const messageIsCode = message !== null && message in strings.errors;
  const code = messageIsCode ? message : codeFromField;

  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      code: 'REQUEST_TIMEOUT',
      message: strings.errors.REQUEST_TIMEOUT,
      retryable: true,
      raw: error,
    };
  }

  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return {
      code: 'NETWORK_OFFLINE',
      message: strings.errors.NETWORK_OFFLINE,
      retryable: true,
      raw: error,
    };
  }

  if (code && code in strings.errors) {
    const translated = strings.errors[code as keyof typeof strings.errors];
    const status =
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof error.status === 'number'
        ? error.status
        : null;
    return {
      code,
      message: translated,
      retryable:
        code === 'NETWORK_OFFLINE' ||
        code === 'REQUEST_TIMEOUT' ||
        (status !== null && status >= 500),
      raw: error,
    };
  }

  const status =
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
      ? error.status
      : null;

  return {
    code: 'UNKNOWN',
    message: strings.common.unknownError,
    retryable: status !== null && status >= 500,
    raw: message ? error : error,
  };
}
