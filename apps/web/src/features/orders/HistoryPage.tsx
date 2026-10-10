import { useState, type FormEvent } from 'react';
import { Download } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Money } from '../../shared/components/Money';
import { OrderStatusBadge } from '../../shared/components/OrderStatusBadge';
import { Pagination } from '../../shared/components/Pagination';
import { PageHeader } from '../../shared/components/PageHeader';
import { downloadCsv, generateCsvFilename, toCsv } from '../../shared/lib/csv';
import { formatDateTime } from '../../shared/lib/format';
import { strings } from '../../shared/strings/id';
import { useExportHistory, useHistoryCashiers, useHistoryOrders } from './historyHooks';
import type { HistoryFilters } from './historyApi';

const statusValues = ['all', 'new', 'processing', 'ready', 'completed', 'cancelled'] as const;
const methodValues = ['all', 'cash', 'transfer', 'ewallet'] as const;
const orderTypeValues = ['all', 'dine_in', 'takeaway'] as const;
const pageSizes = [25, 50, 100] as const;

function jakartaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function validValue<T extends string>(value: string | null, values: readonly T[], fallback: T): T {
  return value && values.includes(value as T) ? (value as T) : fallback;
}

function readPositiveInt(value: string | null, allowed?: readonly number[]): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  if (allowed && !allowed.includes(parsed)) return 25;
  return parsed;
}

function errorText(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : strings.common.unknownError;
  }
  return strings.common.unknownError;
}

export function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = jakartaToday();
  const from = searchParams.get('from') ?? today;
  const to = searchParams.get('to') ?? today;
  const status = validValue(searchParams.get('status'), statusValues, 'all');
  const method = validValue(searchParams.get('method'), methodValues, 'all');
  const orderType = validValue(searchParams.get('type'), orderTypeValues, 'all');
  const cashierId = searchParams.get('cashier') ?? '';
  const search = searchParams.get('q') ?? '';
  const page = readPositiveInt(searchParams.get('page'));
  const pageSize = readPositiveInt(searchParams.get('pageSize'), pageSizes);
  const [searchDraft, setSearchDraft] = useState(search);
  const filters: HistoryFilters = {
    from,
    to,
    status,
    method,
    orderType,
    ...(cashierId ? { cashierId } : {}),
    search,
    page,
    pageSize,
  };
  const orders = useHistoryOrders(filters);
  const cashiers = useHistoryCashiers();
  const exportHistory = useExportHistory({
    from,
    to,
    status,
    method,
    orderType,
    ...(cashierId ? { cashierId } : {}),
    search,
  });

  function updateParams(values: Record<string, string>, resetPage = true): void {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) {
      next.set(key, value);
    }
    if (resetPage) next.set('page', '1');
    setSearchParams(next);
  }

  function updateRange(nextFrom: string, nextTo: string): void {
    updateParams({ from: nextFrom, to: nextTo });
  }

  function applySearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    updateParams({ q: searchDraft.trim() });
  }

  function exportCsv(): void {
    exportHistory.mutate(undefined, {
      onSuccess: (rows) => {
        const csvRows = rows.map((order) => ({
          orderNo: order.order_no,
          createdAt: formatDateTime(order.created_at),
          orderType:
            order.order_type === 'dine_in' ? strings.orders.dineIn : strings.orders.takeaway,
          items: order.order_items.map((item) => `${item.qty}x ${item.item_name}`).join(', '),
          methods: [
            ...new Set(order.payments.map((payment) => strings.history.methods[payment.method])),
          ].join(', '),
          total: order.grand_total,
          status: strings.orders[order.status],
          cashier:
            cashiers.data?.find((cashier) => cashier.id === order.created_by)?.full_name ?? '',
        }));
        downloadCsv(
          toCsv(csvRows, [
            { key: 'orderNo', header: strings.orders.title },
            { key: 'createdAt', header: strings.history.createdAt },
            { key: 'orderType', header: strings.history.orderType },
            { key: 'items', header: strings.history.items },
            { key: 'methods', header: strings.history.method },
            { key: 'total', header: strings.history.total },
            { key: 'status', header: strings.history.status },
            { key: 'cashier', header: strings.history.cashier },
          ]),
          generateCsvFilename('riwayat-pesanan'),
        );
        toast.success(strings.history.exported);
      },
      onError: (error) => toast.error(errorText(error)),
    });
  }

  const rows = orders.data?.rows ?? [];
  const total = orders.data?.total ?? 0;

  if (orders.isPending || cashiers.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }

  if (orders.isError || cashiers.isError) {
    const error = orders.error ?? cashiers.error;
    return (
      <main className="page-state" role="alert">
        <h1>{strings.history.loadError}</h1>
        <p>{errorText(error)}</p>
        <button
          className="button button--secondary"
          onClick={() => {
            void orders.refetch();
            void cashiers.refetch();
          }}
        >
          {strings.common.retry}
        </button>
      </main>
    );
  }

  return (
    <main className="orders-page history-page">
      <PageHeader
        title={strings.history.title}
        actions={
          <>
            <span className="history-result-count">
              {strings.history.resultCount}: {total}
            </span>
            <button
              className="button button--secondary"
              disabled={exportHistory.isPending || total === 0}
              onClick={exportCsv}
            >
              <Download size={17} aria-hidden="true" />
              {exportHistory.isPending ? strings.history.exporting : strings.history.export}
            </button>
          </>
        }
      />

      <section className="history-filters" aria-label={strings.history.filters}>
        <div className="history-presets" aria-label={strings.history.datePresets}>
          <button className="button button--secondary" onClick={() => updateRange(today, today)}>
            {strings.history.today}
          </button>
          <button
            className="button button--secondary"
            onClick={() => {
              const start = new Date(`${today}T00:00:00Z`);
              start.setUTCDate(start.getUTCDate() - 6);
              updateRange(start.toISOString().slice(0, 10), today);
            }}
          >
            {strings.history.last7Days}
          </button>
          <button
            className="button button--secondary"
            onClick={() => updateRange(`${today.slice(0, 7)}-01`, today)}
          >
            {strings.history.thisMonth}
          </button>
        </div>
        <div className="history-filter-fields">
          <label>
            <span>{strings.history.from}</span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(event) => updateParams({ from: event.target.value })}
            />
          </label>
          <label>
            <span>{strings.history.to}</span>
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(event) => updateParams({ to: event.target.value })}
            />
          </label>
          <label>
            <span>{strings.history.status}</span>
            <select
              value={status}
              onChange={(event) => updateParams({ status: event.target.value })}
            >
              {statusValues.map((value) => (
                <option key={value} value={value}>
                  {value === 'all' ? strings.history.all : strings.orders[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{strings.history.method}</span>
            <select
              value={method}
              onChange={(event) => updateParams({ method: event.target.value })}
            >
              {methodValues.map((value) => (
                <option key={value} value={value}>
                  {value === 'all' ? strings.history.all : strings.history.methods[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{strings.history.orderType}</span>
            <select
              value={orderType}
              onChange={(event) => updateParams({ type: event.target.value })}
            >
              {orderTypeValues.map((value) => (
                <option key={value} value={value}>
                  {value === 'all'
                    ? strings.history.all
                    : value === 'dine_in'
                      ? strings.orders.dineIn
                      : strings.orders.takeaway}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{strings.history.cashier}</span>
            <select
              value={cashierId}
              onChange={(event) => updateParams({ cashier: event.target.value })}
            >
              <option value="">{strings.history.all}</option>
              {cashiers.data?.map((cashier) => (
                <option key={cashier.id} value={cashier.id}>
                  {cashier.full_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <form className="history-search" onSubmit={applySearch}>
          <label htmlFor="history-search">{strings.history.search}</label>
          <input
            id="history-search"
            type="search"
            maxLength={80}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={strings.history.searchPlaceholder}
          />
          <button className="button button--secondary" type="submit">
            {strings.history.apply}
          </button>
        </form>
      </section>

      {rows.length === 0 ? (
        <section className="orders-empty" aria-live="polite">
          <h2>{strings.history.noResults}</h2>
          <Link className="button button--primary" to="/pos">
            {strings.pos.title}
          </Link>
        </section>
      ) : (
        <>
          <div className="inventory-table-wrap">
            <table className="inventory-table history-table">
              <caption className="visually-hidden">{strings.history.title}</caption>
              <thead>
                <tr>
                  <th scope="col">{strings.orders.title}</th>
                  <th scope="col">{strings.history.createdAt}</th>
                  <th scope="col">{strings.history.orderType}</th>
                  <th scope="col">{strings.history.items}</th>
                  <th scope="col">{strings.history.method}</th>
                  <th scope="col">{strings.history.total}</th>
                  <th scope="col">{strings.history.status}</th>
                  <th scope="col">{strings.history.cashier}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id}>
                    <th scope="row">
                      <Link to={`/orders/${order.id}`}>{order.order_no}</Link>
                    </th>
                    <td>{formatDateTime(order.created_at)}</td>
                    <td>
                      {order.order_type === 'dine_in'
                        ? strings.orders.dineIn
                        : strings.orders.takeaway}
                    </td>
                    <td className="history-items-summary">
                      {order.order_items.map((item) => `${item.qty}x ${item.item_name}`).join(', ')}
                    </td>
                    <td>
                      {[
                        ...new Set(
                          order.payments.map((payment) => strings.history.methods[payment.method]),
                        ),
                      ].join(', ') || strings.history.notApplicable}
                    </td>
                    <td>
                      <Money value={order.grand_total} />
                    </td>
                    <td>
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td>
                      {cashiers.data?.find((cashier) => cashier.id === order.created_by)
                        ?.full_name ?? strings.history.notApplicable}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onChange={(nextPage, nextPageSize) =>
              updateParams({ page: String(nextPage), pageSize: String(nextPageSize) }, false)
            }
          />
        </>
      )}
    </main>
  );
}
