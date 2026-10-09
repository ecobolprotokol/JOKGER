import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  useCancelOrder,
  useRecentOrders,
  useChangeOrderStatus,
  useReturnCompletedOrder,
  type OrderStatus,
} from './index';
import { useProfile } from '../auth';
import { OrderStatusBadge } from '../../shared/components/OrderStatusBadge';
import { Money } from '../../shared/components/Money';
import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { useRealtime } from '../../shared/hooks/useRealtime';
import { useConnectionStore } from '../../shared/stores/connection';
import { strings } from '../../shared/strings/id';

const statusTabs: Array<'all' | OrderStatus> = [
  'all',
  'new',
  'processing',
  'ready',
  'completed',
  'cancelled',
];
const activeStatuses: OrderStatus[] = ['new', 'processing', 'ready'];

function errorText(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : strings.common.unknownError;
  }
  return strings.common.unknownError;
}

export function OrdersPage() {
  const orders = useRecentOrders();
  const updateStatus = useChangeOrderStatus();
  const cancelMutation = useCancelOrder();
  const returnMutation = useReturnCompletedOrder();
  const profile = useProfile();
  const [tab, setTab] = useState<'all' | OrderStatus>('all');
  const [cancelTarget, setCancelTarget] = useState<{ id: string; orderNo: string } | null>(null);
  const [returnTarget, setReturnTarget] = useState<{ id: string; orderNo: string } | null>(null);
  const realtime = useConnectionStore((state) => state.realtime);
  const online = useConnectionStore((state) => state.online);
  useRealtime({
    table: 'orders',
    filter: 'status=in.(new,processing,ready)',
    queryKey: ['orders'],
  });

  if (orders.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }

  if (orders.isError) {
    return (
      <main className="page-state" role="alert">
        <h1>{strings.orders.loadError}</h1>
        <p>{errorText(orders.error)}</p>
        <button className="button button--secondary" onClick={() => void orders.refetch()}>
          {strings.common.retry}
        </button>
      </main>
    );
  }

  const allOrders = orders.data ?? [];
  const visibleOrders = allOrders.filter((order) => {
    if (tab === 'all') return activeStatuses.includes(order.status);
    return order.status === tab;
  });
  const visibleStatuses: OrderStatus[] = tab === 'all' ? activeStatuses : [tab];
  const statusLabel = (status: OrderStatus) => strings.orders[status];

  return (
    <main className="orders-page">
      <header className="orders-heading">
        <div>
          <p className="eyebrow">{strings.app.operationTitle}</p>
          <h1>{strings.orders.title}</h1>
        </div>
        <div className="orders-heading__actions">
          <span className="realtime-badge" role="status">
            <span
              className={`connection-dot ${realtime === 'connected' ? 'is-online' : 'is-offline'}`}
              aria-hidden="true"
            />
            {realtime === 'connected' ? strings.orders.realtime : strings.orders.autoRefresh}
          </span>
          <button className="button button--secondary" onClick={() => void orders.refetch()}>
            {strings.common.retry}
          </button>
          <Link className="button button--secondary" to="/inventory">
            {strings.inventory.title}
          </Link>
          <Link className="button button--secondary" to="/payment-verification">
            {strings.paymentVerification.title}
          </Link>
        </div>
      </header>

      <nav className="orders-tabs" aria-label={strings.orders.title}>
        {statusTabs.map((status) => (
          <button
            className={tab === status ? 'orders-tab is-selected' : 'orders-tab'}
            key={status}
            aria-pressed={tab === status}
            onClick={() => setTab(status)}
          >
            {status === 'all' ? strings.orders.all : statusLabel(status)}
            <span>
              {status === 'all'
                ? allOrders.filter((order) => activeStatuses.includes(order.status)).length
                : allOrders.filter((order) => order.status === status).length}
            </span>
          </button>
        ))}
      </nav>

      {visibleOrders.length === 0 ? (
        <section className="orders-empty" aria-live="polite">
          <h2>{strings.orders.noOrders}</h2>
          <Link className="button button--primary" to="/pos">
            {strings.pos.title}
          </Link>
        </section>
      ) : (
        <div className={tab === 'all' ? 'orders-board' : 'orders-list'}>
          {visibleStatuses.map((status) => {
            const columnOrders = visibleOrders.filter((order) => order.status === status);
            if (columnOrders.length === 0) return null;
            return (
              <section className="orders-column" key={status} aria-labelledby={`orders-${status}`}>
                <h2 id={`orders-${status}`}>
                  {statusLabel(status)} <span>{columnOrders.length}</span>
                </h2>
                {columnOrders.map((order) => {
                  const nextStatus: OrderStatus | null =
                    order.status === 'new'
                      ? 'processing'
                      : order.status === 'processing'
                        ? 'ready'
                        : null;
                  const itemCount = order.order_items.reduce((sum, item) => sum + item.qty, 0);
                  return (
                    <article className="order-card" key={order.id}>
                      <div className="order-card__topline">
                        <Link
                          className="order-number-small order-card__detail-link"
                          to={`/orders/${order.id}`}
                          aria-label={`${strings.orders.viewDetails} ${order.order_no}`}
                        >
                          {order.order_no}
                        </Link>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <div className="order-card__details">
                        <span>
                          {order.table_label ??
                            order.customer_name ??
                            (order.order_type === 'dine_in'
                              ? strings.orders.dineIn
                              : strings.orders.takeaway)}
                        </span>
                        <span>{itemCount}</span>
                      </div>
                      <div className="order-card__bottomline">
                        <time dateTime={order.created_at}>
                          {new Intl.DateTimeFormat('id-ID', {
                            timeZone: 'Asia/Jakarta',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(order.created_at))}
                        </time>
                        <Money value={order.grand_total} />
                      </div>
                      {order.bill_state === 'open' && (
                        <span className="open-bill-badge">{strings.orders.openBill}</span>
                      )}
                      {nextStatus && (
                        <button
                          className="button button--primary order-card__action"
                          disabled={!online || updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({ orderId: order.id, status: nextStatus })
                          }
                        >
                          {nextStatus === 'processing'
                            ? strings.orders.process
                            : strings.orders.markReady}
                        </button>
                      )}
                      {order.status === 'ready' && (
                        <button
                          className="button button--primary order-card__action"
                          disabled={!online || updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({ orderId: order.id, status: 'completed' })
                          }
                        >
                          {strings.orders.complete}
                        </button>
                      )}
                      {(order.status === 'new' || order.status === 'processing') && (
                        <button
                          className="button button--secondary order-card__action"
                          disabled={!online || cancelMutation.isPending}
                          onClick={() => setCancelTarget({ id: order.id, orderNo: order.order_no })}
                        >
                          {strings.orders.cancel}
                        </button>
                      )}
                      {order.status === 'completed' && profile.data?.role === 'super_admin' && (
                        <button
                          className="button button--secondary order-card__action"
                          disabled={!online || returnMutation.isPending}
                          onClick={() => setReturnTarget({ id: order.id, orderNo: order.order_no })}
                        >
                          {strings.orders.return}
                        </button>
                      )}
                      {updateStatus.isError && (
                        <p className="form-alert" role="alert">
                          {errorText(updateStatus.error)}
                        </p>
                      )}
                      {cancelMutation.isError && (
                        <p className="form-alert" role="alert">
                          {errorText(cancelMutation.error)}
                        </p>
                      )}
                      {returnMutation.isError && (
                        <p className="form-alert" role="alert">
                          {errorText(returnMutation.error)}
                        </p>
                      )}
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
      {cancelTarget && (
        <ConfirmAction
          title={`${strings.orders.cancelTitle} ${cancelTarget.orderNo}?`}
          description={strings.orders.cancelDescription}
          confirmLabel={strings.orders.cancel}
          tone="danger"
          requireReason
          onConfirm={async (reason) => {
            await cancelMutation.mutateAsync({ orderId: cancelTarget.id, reason: reason ?? '' });
            setCancelTarget(null);
          }}
        />
      )}
      {returnTarget && (
        <ConfirmAction
          title={`${strings.orders.returnTitle} ${returnTarget.orderNo}?`}
          description={strings.orders.returnDescription}
          confirmLabel={strings.orders.return}
          tone="danger"
          requireReason
          requireTypedText={returnTarget.orderNo}
          onConfirm={async (reason) => {
            await returnMutation.mutateAsync({ orderId: returnTarget.id, reason: reason ?? '' });
            toast.success(strings.orders.returned);
            setReturnTarget(null);
          }}
        />
      )}
    </main>
  );
}
