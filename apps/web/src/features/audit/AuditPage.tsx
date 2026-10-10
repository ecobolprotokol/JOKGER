import { useMemo, useState } from 'react';
import { Copy, X } from 'lucide-react';
import { ErrorState } from '../../shared/components/ErrorState';
import { Money } from '../../shared/components/Money';
import { formatDateTime } from '../../shared/lib/format';
import { toAppError } from '../../shared/lib/errors';
import { strings } from '../../shared/strings/id';
import { useAuditRows } from './hooks';
import type { AuditRow } from './api';

function auditAction(action: string): string {
  return (
    strings.audit.actions[action as keyof typeof strings.audit.actions] ??
    strings.audit.unknownAction
  );
}

function payloadValue(key: string, value: unknown): JSX.Element {
  if (value === null || value === undefined)
    return <span>{strings.orderDetail.notApplicable}</span>;
  if (typeof value === 'number' && /(amount|cash|discount|total|price|tax|service)/i.test(key)) {
    return <Money value={value} signed={value < 0} />;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span>{String(value)}</span>;
  }
  return <pre className="audit-payload__json">{JSON.stringify(value, null, 2)}</pre>;
}

export function AuditPage(): JSX.Element {
  const query = useAuditRows();
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const rows = useMemo(
    () =>
      (query.data ?? []).filter(
        (row) =>
          (!actionFilter || row.action === actionFilter) &&
          (!actorFilter || row.actor_id === actorFilter) &&
          (!entityFilter || row.entity === entityFilter) &&
          (!from || row.created_at.slice(0, 10) >= from) &&
          (!to || row.created_at.slice(0, 10) <= to),
      ),
    [query.data, actionFilter, actorFilter, entityFilter, from, to],
  );

  if (query.isPending)
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  if (query.isError)
    return (
      <main className="page-state">
        <h1>{strings.audit.loadError}</h1>
        <ErrorState error={toAppError(query.error)} onRetry={() => void query.refetch()} />
      </main>
    );

  const actions = [...new Set((query.data ?? []).map((row) => row.action))];
  const actors = [
    ...new Map(
      (query.data ?? []).flatMap((row) =>
        row.actor_id
          ? [[row.actor_id, row.profiles?.full_name ?? strings.orderDetail.unknownStaff] as const]
          : [],
      ),
    ).entries(),
  ];
  const entities = [...new Set((query.data ?? []).map((row) => row.entity))];

  return (
    <main className="settings-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{strings.app.operationTitle}</p>
          <h1>{strings.audit.title}</h1>
        </div>
      </header>
      <section className="report-filter" aria-label={strings.audit.filters}>
        <label className="field">
          <span>{strings.audit.action}</span>
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="">{strings.orders.all}</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {auditAction(action)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{strings.audit.actor}</span>
          <select value={actorFilter} onChange={(event) => setActorFilter(event.target.value)}>
            <option value="">{strings.orders.all}</option>
            {actors.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{strings.audit.entity}</span>
          <select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)}>
            <option value="">{strings.orders.all}</option>
            {entities.map((entity) => (
              <option key={entity}>{entity}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{strings.audit.from}</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field">
          <span>{strings.audit.to}</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </section>
      {rows.length === 0 ? (
        <section className="orders-empty" role="status">
          <h2>{strings.audit.empty}</h2>
        </section>
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <caption className="visually-hidden">{strings.audit.title}</caption>
            <thead>
              <tr>
                <th scope="col">{strings.audit.time}</th>
                <th scope="col">{strings.audit.actor}</th>
                <th scope="col">{strings.audit.action}</th>
                <th scope="col">{strings.audit.entity}</th>
                <th scope="col">{strings.audit.entityId}</th>
                <th scope="col">{strings.audit.details}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>{row.profiles?.full_name ?? strings.orderDetail.unknownStaff}</td>
                  <td>{auditAction(row.action)}</td>
                  <td>{row.entity}</td>
                  <td>
                    <button
                      className="text-button audit-entity-id"
                      onClick={() => void navigator.clipboard.writeText(row.entity_id ?? '')}
                    >
                      {row.entity_id ?? strings.orderDetail.notApplicable}
                      <Copy size={14} aria-hidden="true" />
                    </button>
                  </td>
                  <td>
                    <button className="button button--secondary" onClick={() => setSelected(row)}>
                      {strings.audit.details}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <div
          className="audit-drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <aside
            className="audit-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-detail-title"
          >
            <header>
              <div>
                <p className="eyebrow">{auditAction(selected.action)}</p>
                <h2 id="audit-detail-title">{selected.entity}</h2>
              </div>
              <button
                className="icon-button"
                aria-label={strings.common.cancel}
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            </header>
            <p>
              {formatDateTime(selected.created_at)} ·{' '}
              {selected.profiles?.full_name ?? strings.orderDetail.unknownStaff}
            </p>
            <dl>
              {Object.entries(selected.payload ?? {}).map(([key, value]) => (
                <div key={key}>
                  <dt>
                    {strings.audit.payloadLabels[key as keyof typeof strings.audit.payloadLabels] ??
                      key}
                  </dt>
                  <dd>{payloadValue(key, value)}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      )}
    </main>
  );
}
