import { useConnectionStore } from '../stores/connection';
import { strings } from '../strings/id';

export function PrinterStatus(): JSX.Element {
  const printer = useConnectionStore((state) => state.printer);
  const isConnected = printer === 'connected';
  const isDisconnected = printer === 'disconnected';
  const isUnsupported = printer === 'unsupported';

  return (
    <span
      className={`printer-status ${isConnected ? 'is-connected' : isDisconnected ? 'is-disconnected' : 'is-unsupported'}`}
      role="status"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      <span>
        {isConnected
          ? strings.common.loading
          : isDisconnected
            ? 'Printer tidak terhubung'
            : isUnsupported
              ? 'Printer tidak didukung di browser ini'
              : 'Memeriksa printer...'}
      </span>
    </span>
  );
}
