import { useConnectionStore } from '../stores/connection';
import { strings } from '../strings/id';

export function RealtimeBadge(): JSX.Element {
  const realtime = useConnectionStore((state) => state.realtime);
  const isConnected = realtime === 'connected';
  const isDegraded = realtime === 'degraded';

  return (
    <span
      className={`realtime-badge ${isConnected ? 'is-connected' : isDegraded ? 'is-degraded' : ''}`}
      role="status"
    >
      <span className="realtime-badge__dot" aria-hidden="true" />
      <span className="realtime-badge__text">
        {isConnected
          ? strings.orders.realtime
          : isDegraded
            ? 'Realtime terputus'
            : 'Menghubungkan...'}
      </span>
    </span>
  );
}
