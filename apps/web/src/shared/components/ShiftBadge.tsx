import { useActiveShift } from '../../features/shift';
import { formatTime } from '../lib/format';
import { strings } from '../strings/id';

export function ShiftBadge(): JSX.Element {
  const shiftQuery = useActiveShift();

  if (shiftQuery.isPending) {
    return (
      <span className="shift-badge shift-badge--loading" role="status">
        <span className="shift-badge__spinner" aria-hidden="true" />
        <span>{strings.common.loading}</span>
      </span>
    );
  }

  if (shiftQuery.isError || !shiftQuery.data) {
    return (
      <span className="shift-badge shift-badge--closed" role="status">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>{strings.shift.noOpenShift}</span>
      </span>
    );
  }

  const shift = shiftQuery.data;
  return (
    <span className="shift-badge shift-badge--open" role="status">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span>
        {strings.shift.openedAt} {formatTime(shift.opened_at)}
      </span>
    </span>
  );
}
