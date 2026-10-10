import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, ClipboardCheck } from 'lucide-react';
import { useOpnames, useOpenOpname } from './hooks';
import { ErrorState } from '../../shared/components/ErrorState';
import { PageHeader } from '../../shared/components/PageHeader';
import { EmptyState } from '../../shared/components/EmptyState';
import { formatDateTime } from '../../shared/lib/format';
import { strings } from '../../shared/strings/id';
import { toAppError } from '../../shared/lib/errors';

export function OpnameListPage(): JSX.Element {
  const query = useOpnames();
  const open = useOpenOpname();
  const navigate = useNavigate();

  if (query.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }
  if (query.isError) {
    return (
      <main className="page-state">
        <h1>{strings.opname.loadError}</h1>
        <ErrorState error={toAppError(query.error)} onRetry={() => void query.refetch()} />
      </main>
    );
  }

  const opnames = query.data ?? [];
  const draft = opnames.find((opname) => opname.status === 'draft');

  return (
    <main className="opname-page">
      <PageHeader
        title={strings.opname.title}
        actions={
          <button
            className="button button--primary"
            disabled={Boolean(draft) || open.isPending}
            onClick={() =>
              open.mutate(undefined, {
                onSuccess: (result) => navigate(`/inventory/opname/${result.id}`),
              })
            }
          >
            <ClipboardCheck size={17} aria-hidden="true" />
            {draft ? strings.opname.draftRunning : strings.opname.start}
          </button>
        }
      />
      {open.isError && (
        <p className="form-alert" role="alert">
          {open.error.message}
        </p>
      )}
      {opnames.length === 0 ? (
        <EmptyState
          icon={<CalendarClock size={28} />}
          title={strings.opname.emptyTitle}
          description={strings.opname.emptyDescription}
          action={{
            label: strings.opname.start,
            onClick: () =>
              open.mutate(undefined, {
                onSuccess: (result) => navigate(`/inventory/opname/${result.id}`),
              }),
          }}
        />
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <caption className="visually-hidden">{strings.opname.title}</caption>
            <thead>
              <tr>
                <th scope="col">{strings.opname.openedAt}</th>
                <th scope="col">{strings.opname.openedBy}</th>
                <th scope="col">{strings.opname.status}</th>
                <th scope="col">{strings.opname.finalizedAt}</th>
              </tr>
            </thead>
            <tbody>
              {opnames.map((opname) => (
                <tr key={opname.id}>
                  <th scope="row">
                    <Link to={`/inventory/opname/${opname.id}`}>
                      {formatDateTime(opname.opened_at)}
                    </Link>
                  </th>
                  <td>{opname.profiles?.full_name ?? strings.orderDetail.unknownStaff}</td>
                  <td>
                    {opname.status === 'draft' ? strings.opname.draft : strings.opname.finalized}
                  </td>
                  <td>
                    {opname.finalized_at
                      ? formatDateTime(opname.finalized_at)
                      : strings.orderDetail.notApplicable}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
