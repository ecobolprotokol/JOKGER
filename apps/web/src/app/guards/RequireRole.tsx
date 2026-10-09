import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useProfile } from '../../features/auth';
import type { Profile } from '../../features/auth';

export function RequireRole({ children, role }: { children: ReactNode; role: Profile['role'] }) {
  const profile = useProfile();
  if (profile.data?.role !== role) {
    return <Navigate to="/403" replace />;
  }
  return <>{children}</>;
}
