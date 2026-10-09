import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { signOut } from '../../features/auth/api';

export const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 30_000;
const CHECK_INTERVAL_MS = 60_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;

export function useIdleTimeout(active: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!active) {
      return;
    }

    let lastActivity = Date.now();
    let signingOut = false;
    const recordActivity = () => {
      const now = Date.now();
      if (now - lastActivity >= ACTIVITY_THROTTLE_MS) {
        lastActivity = now;
      }
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });
    const timer = window.setInterval(() => {
      if (signingOut || Date.now() - lastActivity < IDLE_TIMEOUT_MS) {
        return;
      }
      signingOut = true;
      void signOut().finally(() => {
        queryClient.clear();
        window.history.replaceState(null, '', '/login?reason=idle');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
    }, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
    };
  }, [active, queryClient]);
}
