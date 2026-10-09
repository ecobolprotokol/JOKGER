import * as Sentry from '@sentry/react';

function sanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
      .replace(/\b\d{8,}\b/g, '[nomor]')
      .replace(/(bearer\s+)[\w.-]+/gi, '$1[token]');
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        const sensitiveKey = /email|phone|account|token|password|proof|reference/i.test(key);
        return [key, sensitiveKey ? '[disamarkan]' : sanitize(item)];
      }),
    );
  }

  return value;
}

export function logError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, {
    extra: sanitize(context ?? {}) as Record<string, unknown>,
  });
}

export function logWarn(message: string, context?: Record<string, unknown>): void {
  if (import.meta.env.VITE_APP_ENV === 'local') {
    Sentry.addBreadcrumb({
      category: 'warning',
      message,
      data: sanitize(context ?? {}) as Record<string, unknown>,
      level: 'warning',
    });
  }
}

export function logInfo(message: string): void {
  if (import.meta.env.VITE_APP_ENV === 'local') {
    Sentry.addBreadcrumb({ category: 'application', message, level: 'info' });
  }
}
