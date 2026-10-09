import { useConnectionStore } from '../stores/connection';
import { strings } from '../strings/id';

export function OfflineBanner(): JSX.Element | null {
  const online = useConnectionStore((state) => state.online);
  if (online) return null;

  return (
    <div className="offline-banner" role="alert" aria-live="assertive">
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.59 3.43A16 16 0 0 0 2 12.55" />
      </svg>
      <span>{strings.pos.offline}</span>
    </div>
  );
}
