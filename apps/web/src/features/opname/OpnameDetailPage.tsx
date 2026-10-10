import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, CircleAlert, Search } from 'lucide-react';
import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { ErrorState } from '../../shared/components/ErrorState';
import { Money } from '../../shared/components/Money';
import { PageHeader } from '../../shared/components/PageHeader';
import { formatDateTime } from '../../shared/lib/format';
import { strings } from '../../shared/strings/id';
import { toAppError } from '../../shared/lib/errors';
import { useUnsavedChanges } from '../../shared/hooks/useUnsavedChanges';
import { lineDifference, summarizeDifferences } from './logic';
import { useFinalizeOpname, useOpname, useSaveOpnameCounts } from './hooks';

export function OpnameDetailPage(): JSX.Element {
  const { opnameId = '' } = useParams();
  const query = useOpname(opnameId);
  const save = useSaveOpnameCounts();
  const finalize = useFinalizeOpname();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [filter, setFilter] = useState<'all' | 'difference' | 'uncounted'>('all');
  const [search, setSearch] = useState('');
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const version = useRef(0);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const opnameData = query.data;

  useEffect(() => {
    if (!opnameData) return;
    setCounts(
      Object.fromEntries(
        opnameData.stock_opname_lines.map((line) => [
          line.inventory_item_id,
          line.counted_qty === null ? '' : String(line.counted_qty),
        ]),
      ),
    );
  }, [opnameData]);

  const isFinalized = query.data?.status === 'finalized';
  useUnsavedChanges(dirty && !isFinalized);
  const currentCounts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(counts).map(([id, value]) => [
          id,
          value.trim() === '' ? null : Number(value),
        ]),
      ),
    [counts],
  );

  const persistCounts = useCallback(async (): Promise<boolean> => {
    if (!query.data || isFinalized) return false;
    const currentVersion = version.current;
    const batch = query.data.stock_opname_lines.flatMap((line) => {
      const value = currentCounts[line.inventory_item_id];
      return value === null || value === undefined
        ? []
        : [{ inventory_item_id: line.inventory_item_id, counted_qty: value }];
    });
    try {
      await save.mutateAsync({ opnameId, counts: batch });
      if (version.current === currentVersion) {
        setDirty(false);
        setSaveFailed(false);
      }
      return true;
    } catch {
      setSaveFailed(true);
      return false;
    }
  }, [currentCounts, isFinalized, opnameId, query.data, save]);

  useEffect(() => {
    if (!dirty || isFinalized) return;
    const timer = window.setTimeout(() => void persistCounts(), 800);
    return () => window.clearTimeout(timer);
  }, [dirty, isFinalized, persistCounts]);

  if (query.isPending)
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  if (query.isError)
    return (
      <main className="page-state">
        <h1>{strings.opname.loadError}</h1>
        <ErrorState error={toAppError(query.error)} onRetry={() => void query.refetch()} />
      </main>
    );
  if (!query.data)
    return (
      <main className="page-state">
        <h1>{strings.opname.notFound}</h1>
        <Link className="button button--secondary" to="/inventory/opname">
          {strings.opname.backToList}
        </Link>
      </main>
    );

  const lines = query.data.stock_opname_lines;
  const summary = summarizeDifferences(lines, currentCounts);
  const filtered = lines.filter((line) => {
    const counted = currentCounts[line.inventory_item_id] ?? null;
    const difference = lineDifference(line, counted);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'difference' && difference !== null && difference !== 0) ||
      (filter === 'uncounted' && counted === null);
    return (
      matchesFilter &&
      line.inventory_items.name
        .toLocaleLowerCase('id-ID')
        .includes(search.toLocaleLowerCase('id-ID'))
    );
  });

  function moveFocus(currentId: string, direction: number): void {
    const visibleIds = filtered.map((line) => line.inventory_item_id);
    const currentIndex = visibleIds.indexOf(currentId);
    const nextId = visibleIds[currentIndex + direction];
    if (nextId) inputs.current.get(nextId)?.focus();
  }

  return (
    <main className="opname-page">
      <PageHeader
        eyebrow={strings.opname.title}
        title={formatDateTime(query.data.opened_at)}
        description={query.data.profiles?.full_name ?? strings.orderDetail.unknownStaff}
        actions={
          <div className="opname-detail__actions">
            <span className="opname-save-status" role="status" aria-live="polite">
              {save.isPending
                ? strings.opname.saving
                : saveFailed
                  ? strings.opname.saveFailed
                  : dirty
                    ? strings.opname.unsaved
                    : strings.opname.saved}
            </span>
            {saveFailed && (
              <button className="button button--secondary" onClick={() => void persistCounts()}>
                {strings.common.retry}
              </button>
            )}
            {!isFinalized && (
              <button
                className="button button--primary"
                disabled={dirty || save.isPending}
                onClick={() => setConfirmFinalize(true)}
              >
                {strings.opname.finalize}
              </button>
            )}
          </div>
        }
      />
      {isFinalized && (
        <p className="form-success" role="status">
          {strings.opname.finalizedBanner}{' '}
          {query.data.finalized_at ? formatDateTime(query.data.finalized_at) : ''}
        </p>
      )}
      <section className="opname-summary" aria-label={strings.opname.summary}>
        <div>
          <strong>{lines.length}</strong>
          <span>{strings.opname.materials}</span>
        </div>
        <div>
          <strong>{summary.changedItems}</strong>
          <span>{strings.opname.differences}</span>
        </div>
        <div>
          <strong>{summary.uncounted}</strong>
          <span>{strings.opname.uncounted}</span>
        </div>
        <div>
          <Money value={summary.totalValue} signed />
          <span>{strings.opname.differenceValue}</span>
        </div>
      </section>
      <div className="opname-toolbar">
        <label className="field opname-search">
          <span>{strings.opname.search}</span>
          <span className="opname-search__input">
            <Search size={16} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </span>
        </label>
        <div className="opname-filter" role="group" aria-label={strings.opname.filters}>
          <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>
            {strings.opname.all}
          </button>
          <button
            className={filter === 'difference' ? 'is-active' : ''}
            onClick={() => setFilter('difference')}
          >
            {strings.opname.onlyDifferences}
          </button>
          <button
            className={filter === 'uncounted' ? 'is-active' : ''}
            onClick={() => setFilter('uncounted')}
          >
            {strings.opname.onlyUncounted}
          </button>
        </div>
      </div>
      {lines.length === 0 ? (
        <div className="orders-empty">
          <h2>{strings.opname.noMaterials}</h2>
        </div>
      ) : filtered.length === 0 ? (
        <div className="orders-empty">
          <h2>{strings.opname.noFilterResults}</h2>
        </div>
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table opname-table">
            <caption className="visually-hidden">{strings.opname.title}</caption>
            <thead>
              <tr>
                <th scope="col">{strings.inventory.name}</th>
                <th scope="col">{strings.opname.systemStock}</th>
                <th scope="col">{strings.opname.countedStock}</th>
                <th scope="col">{strings.opname.difference}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((line) => {
                const inputValue = counts[line.inventory_item_id] ?? '';
                const counted = inputValue.trim() === '' ? null : Number(inputValue);
                const difference = lineDifference(line, counted);
                return (
                  <tr key={line.inventory_item_id}>
                    <th scope="row">
                      {line.inventory_items.name}
                      <small>{line.inventory_items.unit}</small>
                    </th>
                    <td className="numeric-cell">
                      {line.system_qty.toLocaleString('id-ID', { maximumFractionDigits: 3 })}
                    </td>
                    <td>
                      <input
                        ref={(element) => {
                          if (element) inputs.current.set(line.inventory_item_id, element);
                        }}
                        className="opname-count"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="999999999.999"
                        step="0.001"
                        aria-label={`${strings.opname.countedStock}: ${line.inventory_items.name}`}
                        value={inputValue}
                        disabled={isFinalized}
                        onChange={(event) => {
                          version.current += 1;
                          setCounts((current) => ({
                            ...current,
                            [line.inventory_item_id]: event.target.value,
                          }));
                          setDirty(true);
                          setSaveFailed(false);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            moveFocus(line.inventory_item_id, event.shiftKey ? -1 : 1);
                          }
                        }}
                      />
                    </td>
                    <td
                      className={`opname-difference ${difference === null ? 'is-pending' : difference === 0 ? 'is-even' : difference > 0 ? 'is-positive' : 'is-negative'}`}
                    >
                      {difference === null ? (
                        strings.opname.notCounted
                      ) : (
                        <>
                          <span aria-hidden="true">
                            {difference === 0 ? <Check size={15} /> : <CircleAlert size={15} />}
                          </span>
                          {difference > 0 ? '+' : ''}
                          {difference.toLocaleString('id-ID', { maximumFractionDigits: 3 })}{' '}
                          {line.inventory_items.unit}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {confirmFinalize && (
        <ConfirmAction
          title={strings.opname.finalizeTitle}
          description={`${strings.opname.finalizeDescription} ${summary.changedItems} · ${strings.opname.differenceValue}:`}
          confirmLabel={strings.opname.finalize}
          requireTypedText="FINALISASI"
          onConfirm={async () => {
            if (dirty && !(await persistCounts())) throw new Error(strings.opname.saveFailed);
            await finalize.mutateAsync(opnameId);
            setConfirmFinalize(false);
          }}
        />
      )}
    </main>
  );
}
