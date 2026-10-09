import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { signOut } from '../../features/auth/api';
import { useAuthSession, useProfile } from '../../features/auth';
import { strings } from '../../shared/strings/id';

function isRetryable(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'retryable' in error && error.retryable === true
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { loading, session } = useAuthSession();
  const profile = useProfile();
  const profileUnavailable = profile.isError && !isRetryable(profile.error);
  const profileMissing = profile.isSuccess && !profile.data;

  useEffect(() => {
    if (!loading && session && (profileMissing || profileUnavailable)) {
      void signOut().finally(() => queryClient.clear());
    }
  }, [loading, profileMissing, profileUnavailable, queryClient, session]);

  if (loading || (session && profile.isPending)) {
    return (
      <main className="full-screen-state" role="status">
        {strings.auth.loading}
      </main>
    );
  }

  if (profile.isError && isRetryable(profile.error)) {
    return (
      <main className="page-state" role="alert">
        <h1>{strings.app.loadError}</h1>
        <p>{profile.error.message}</p>
        <button className="button button--secondary" onClick={() => void profile.refetch()}>
          {strings.common.retry}
        </button>
      </main>
    );
  }

  if (!session || profileMissing || profileUnavailable) {
    const redirect = `${location.pathname}${location.search}`;
    const reason = session && (profileMissing || profileUnavailable) ? '?reason=inactive' : '';
    return <Navigate to={`/login${reason}`} replace state={{ redirect }} />;
  }

  return <>{children}</>;
}
