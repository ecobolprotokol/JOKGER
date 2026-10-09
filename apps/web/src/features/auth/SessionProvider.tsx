import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { useIdleTimeout } from '../../shared/hooks/useIdleTimeout';
import type { Session } from './api';

export type SessionState = {
  loading: boolean;
  session: Session | null;
};

const SessionContext = createContext<SessionState>({ loading: true, session: null });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ loading: true, session: null });

  useEffect(() => {
    if (!supabase) {
      setState({ loading: false, session: null });
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setState({ loading: false, session: data.session });
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ loading: false, session });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useIdleTimeout(Boolean(state.session));

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useAuthSession(): SessionState {
  return useContext(SessionContext);
}
