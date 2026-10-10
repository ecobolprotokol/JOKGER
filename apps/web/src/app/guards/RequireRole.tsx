import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../../features/auth';
import type { Profile } from '../../features/auth';
import { strings } from '../../shared/strings/id';

export function RequireRole({
  children,
  role,
}: {
  children: ReactNode;
  role: Profile['role'];
}): JSX.Element {
  const profile = useProfile();
  if (profile.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }
  if (profile.data?.role !== role) {
    return (
      <main className="page-state" role="alert">
        <h1>{strings.errors.forbiddenTitle}</h1>
        <p>{strings.errors.NOT_AUTHORIZED}</p>
        <Link className="button button--primary" to="/">
          {strings.errors.backToShift}
        </Link>
      </main>
    );
  }
  return <>{children}</>;
}
