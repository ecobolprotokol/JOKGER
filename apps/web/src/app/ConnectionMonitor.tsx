import { useEffect, type ReactNode } from 'react';
import { useConnectionStore } from '../shared/stores/connection';

export function ConnectionMonitor({ children }: { children: ReactNode }) {
  const setOnline = useConnectionStore((state) => state.setOnline);

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, [setOnline]);

  return children;
}
