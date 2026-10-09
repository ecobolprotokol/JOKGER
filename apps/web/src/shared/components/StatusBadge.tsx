type StatusKind = 'order' | 'payment' | 'shift';

const statusConfig: Record<
  StatusKind,
  Record<string, { label: string; color: string; icon: string }>
> = {
  order: {
    new: { label: 'Baru', color: 'info', icon: 'circle-dot' },
    processing: { label: 'Diproses', color: 'warning', icon: 'flame' },
    ready: { label: 'Menunggu diambil', color: 'brand', icon: 'bell' },
    completed: { label: 'Selesai', color: 'success', icon: 'check' },
    cancelled: { label: 'Dibatalkan', color: 'danger', icon: 'x' },
  },
  payment: {
    pending_verification: { label: 'Menunggu verifikasi', color: 'warning', icon: 'clock' },
    verified: { label: 'Terverifikasi', color: 'success', icon: 'badge-check' },
    rejected: { label: 'Ditolak', color: 'danger', icon: 'ban' },
  },
  shift: {
    open: { label: 'Kasir terbuka', color: 'success', icon: 'unlock' },
    closed: { label: 'Kasir tertutup', color: 'muted', icon: 'lock' },
  },
};

const iconMap: Record<string, JSX.Element> = {
  'circle-dot': (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  flame: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M8.5 14.5A2.5 2.5 0 0 1 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a5.5 5.5 0 0 1-11 0c0-2.5 1-4.9 3-6.5 2.226-1.946 3.074-3.856 2-6z" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  'badge-check': (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-4.78 0 4 4 0 0 1 0-6.76Z" />
      <path d="M12 15h.01M12 9h.01" />
    </svg>
  ),
  ban: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
    </svg>
  ),
  unlock: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
};

export function StatusBadge({ kind, status }: { kind: StatusKind; status: string }): JSX.Element {
  const config = statusConfig[kind]?.[status] ?? {
    label: status,
    color: 'muted',
    icon: 'circle-dot',
  };
  const Icon = iconMap[config.icon] ?? iconMap['circle-dot'];

  return (
    <span
      className={`status-badge status-badge--${config.color}`}
      aria-label={`${config.label}, ${kind === 'order' ? 'pesanan' : kind === 'payment' ? 'pembayaran' : 'shift'}`}
    >
      <span className="status-badge__icon" aria-hidden="true">
        {Icon}
      </span>
      <span className="status-badge__text">{config.label}</span>
    </span>
  );
}
