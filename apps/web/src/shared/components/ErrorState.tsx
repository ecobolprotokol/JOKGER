import type { AppError } from '../lib/errors';
import { strings } from '../strings/id';

export function ErrorState({
  error,
  onRetry,
}: {
  error: AppError;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div className="error-state" role="alert">
      <div className="error-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 className="error-state__title">{strings.errors.UNKNOWN}</h2>
      <p className="error-state__message">{error.message}</p>
      {error.retryable && onRetry && (
        <button className="button button--primary error-state__retry" onClick={onRetry}>
          {strings.common.retry}
        </button>
      )}
    </div>
  );
}
