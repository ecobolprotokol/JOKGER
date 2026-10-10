import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useProfile } from '../auth';
import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { Money } from '../../shared/components/Money';
import { OrderStatusBadge } from '../../shared/components/OrderStatusBadge';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { useCancelOrder, useOrderDetail, useReturnCompletedOrder, type OrderStatus } from './index';
import { formatDateTime } from '../../shared/lib/format';
import { strings } from '../../shared/strings/id';

function errorText(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : strings.common.unknownError;
  }
  return strings.common.unknownError;
}

function getAuditDescription(action: string, payload: Record<string, unknown> | null): string {
  if (action === 'order.create') return strings.orderDetail.created;
  if (action === 'order.status_change') {
    const statusLabel = (value: unknown) => {
      const labels: Record<OrderStatus, string> = {
        new: strings.orders.new,
        processing: strings.orders.processing,
        ready: strings.orders.ready,
        completed: strings.orders.completed,
        cancelled: strings.orders.cancelled,
      };
      return typeof value === 'string' && value in labels
        ? labels[value as OrderStatus]
        : strings.orderDetail.unknownStatus;
    };
    const from = statusLabel(payload?.from);
    const to = statusLabel(payload?.to);
    return `${strings.orderDetail.statusChanged}: ${from} → ${to}`;
  }
  if (action === 'order.cancel') return strings.orderDetail.cancelled;
  if (action === 'order.return') return strings.orderDetail.returned;
  if (action === 'order.void_item') return strings.orderDetail.itemVoided;
  return strings.orderDetail.otherChange;
}

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const profile = useProfile();
  const canViewHistory = profile.data?.role === 'admin' || profile.data?.role === 'super_admin';
  const detailQuery = useOrderDetail(orderId, canViewHistory);
  const cancelMutation = useCancelOrder();
  const returnMutation = useReturnCompletedOrder();
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'return' | null>(null);

  if (detailQuery.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }

  if (detailQuery.isError) {
    return (
      <main className="page-state" role="alert">
        <h1>{strings.orderDetail.loadError}</h1>
        <p>{errorText(detailQuery.error)}</p>
        <button className="button button--secondary" onClick={() => void detailQuery.refetch()}>
          {strings.common.retry}
        </button>
      </main>
    );
  }

  const order = detailQuery.data;
  if (!order) {
    return (
      <main className="page-state" role="status">
        <h1>{strings.orderDetail.notFound}</h1>
        <Link className="button button--primary" to="/orders">
          {strings.orderDetail.backToOrders}
        </Link>
      </main>
    );
  }

  const verifiedTotal = order.payments
    .filter((payment) => !payment.is_refund && payment.status === 'verified')
    .reduce((total, payment) => total + payment.amount, 0);
  const pendingTotal = order.payments
    .filter((payment) => !payment.is_refund && payment.status === 'pending_verification')
    .reduce((total, payment) => total + payment.amount, 0);
  const remaining = Math.max(0, order.grand_total - verifiedTotal - pendingTotal);
  const canCancel = order.status === 'new' || order.status === 'processing';
  const canReturn = order.status === 'completed' && canViewHistory;

  return (
    <main className="shift-page order-detail-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{strings.app.operationTitle}</p>
          <h1>{order.order_no}</h1>
        </div>
        <div className="order-detail__header-actions">
          <OrderStatusBadge status={order.status} />
          <Link className="button button--secondary" to="/orders">
            {strings.orderDetail.backToOrders}
          </Link>
          {canCancel && (
            <button className="button button--danger" onClick={() => setConfirmAction('cancel')}>
              {strings.orders.cancel}
            </button>
          )}
          {canReturn && (
            <button className="button button--danger" onClick={() => setConfirmAction('return')}>
              {strings.orders.return}
            </button>
          )}
        </div>
      </header>

      <section className="shift-panel order-detail__summary" aria-labelledby="order-summary-title">
        <h2 id="order-summary-title">{strings.orderDetail.summary}</h2>
        <dl className="order-detail__metadata">
          <div>
            <dt>{strings.orderDetail.createdAt}</dt>
            <dd>{formatDateTime(order.created_at)}</dd>
          </div>
          <div>
            <dt>{strings.orderDetail.createdBy}</dt>
            <dd>{order.created_by_name || strings.orderDetail.unknownStaff}</dd>
          </div>
          <div>
            <dt>{strings.orderDetail.orderType}</dt>
            <dd>
              {order.order_type === 'dine_in' ? strings.orders.dineIn : strings.orders.takeaway}
            </dd>
          </div>
          <div>
            <dt>{strings.orderDetail.customer}</dt>
            <dd>{order.table_label || order.customer_name || strings.orderDetail.notProvided}</dd>
          </div>
          {order.bill_state && (
            <div>
              <dt>{strings.orderDetail.billState}</dt>
              <dd>
                {order.bill_state === 'open'
                  ? strings.orderDetail.billOpen
                  : strings.orderDetail.billClosed}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="shift-panel order-detail__section" aria-labelledby="order-items-title">
        <h2 id="order-items-title">{strings.orderDetail.items}</h2>
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <caption className="visually-hidden">{strings.orderDetail.items}</caption>
            <thead>
              <tr>
                <th scope="col">{strings.orderDetail.item}</th>
                <th scope="col">{strings.orderDetail.quantity}</th>
                <th scope="col">{strings.orderDetail.unitPrice}</th>
                <th scope="col">{strings.orderDetail.lineTotal}</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map((item) => (
                <tr key={item.id} className={item.is_voided ? 'order-detail__voided' : undefined}>
                  <th scope="row">
                    {item.item_name}
                    {item.is_voided && (
                      <span className="order-detail__void-label">{strings.orderDetail.voided}</span>
                    )}
                    {item.modifiers.length > 0 && (
                      <small className="order-detail__subtext">
                        {item.modifiers
                          .map((modifier) => `${modifier.group}: ${modifier.name}`)
                          .join(', ')}
                      </small>
                    )}
                    {item.note && <small className="order-detail__subtext">{item.note}</small>}
                    {item.void_reason && (
                      <small className="order-detail__subtext">{item.void_reason}</small>
                    )}
                  </th>
                  <td>{item.qty}</td>
                  <td>
                    <Money value={item.unit_price} />
                  </td>
                  <td>
                    <Money value={item.line_total} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="shift-panel order-detail__section" aria-labelledby="order-totals-title">
        <h2 id="order-totals-title">{strings.orderDetail.totals}</h2>
        <dl className="order-detail__totals">
          <div>
            <dt>{strings.pos.subtotal}</dt>
            <dd>
              <Money value={order.subtotal} />
            </dd>
          </div>
          {order.discount_total > 0 && (
            <div>
              <dt>
                {strings.orderDetail.discount}
                {order.voucher_code ? ` (${order.voucher_code})` : ''}
              </dt>
              <dd>
                <Money value={-order.discount_total} signed />
              </dd>
            </div>
          )}
          {order.service_amount > 0 && (
            <div>
              <dt>{strings.pos.serviceFee}</dt>
              <dd>
                <Money value={order.service_amount} />
              </dd>
            </div>
          )}
          {order.tax_amount > 0 && (
            <div>
              <dt>{strings.pos.tax}</dt>
              <dd>
                <Money value={order.tax_amount} />
              </dd>
            </div>
          )}
          {order.rounding_amount !== 0 && (
            <div>
              <dt>{strings.pos.rounding}</dt>
              <dd>
                <Money value={order.rounding_amount} signed />
              </dd>
            </div>
          )}
          <div className="order-detail__grand-total">
            <dt>{strings.pos.total}</dt>
            <dd>
              <Money value={order.grand_total} />
            </dd>
          </div>
          <div>
            <dt>{strings.orderDetail.verified}</dt>
            <dd>
              <Money value={verifiedTotal} />
            </dd>
          </div>
          {pendingTotal > 0 && (
            <div>
              <dt>{strings.orderDetail.pending}</dt>
              <dd>
                <Money value={pendingTotal} />
              </dd>
            </div>
          )}
          <div>
            <dt>{strings.orderDetail.remaining}</dt>
            <dd>
              <Money value={remaining} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="shift-panel order-detail__section" aria-labelledby="order-payments-title">
        <h2 id="order-payments-title">{strings.orderDetail.payments}</h2>
        {order.payments.length === 0 ? (
          <p>{strings.orderDetail.noPayments}</p>
        ) : (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <caption className="visually-hidden">{strings.orderDetail.payments}</caption>
              <thead>
                <tr>
                  <th scope="col">{strings.orderDetail.paymentMethod}</th>
                  <th scope="col">{strings.orderDetail.paymentAccount}</th>
                  <th scope="col">{strings.orderDetail.reference}</th>
                  <th scope="col">{strings.orderDetail.paymentStatus}</th>
                  <th scope="col">{strings.orderDetail.amount}</th>
                </tr>
              </thead>
              <tbody>
                {order.payments.map((payment) => (
                  <tr key={payment.id}>
                    <th scope="row">
                      {payment.is_refund
                        ? strings.orderDetail.refund
                        : strings.orderDetail.methods[payment.method]}
                      {payment.status === 'pending_verification' && (
                        <Link
                          className="order-detail__verify-link"
                          to={`/payment-verification?payment=${payment.id}`}
                        >
                          {strings.orderDetail.verify}
                        </Link>
                      )}
                    </th>
                    <td>
                      {payment.payment_accounts?.provider ?? strings.orderDetail.notApplicable}
                    </td>
                    <td>{payment.reference_no ?? strings.orderDetail.notApplicable}</td>
                    <td>
                      <StatusBadge kind="payment" status={payment.status} />
                    </td>
                    <td>
                      <Money value={payment.amount} signed={payment.is_refund} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canViewHistory && (
        <section
          className="shift-panel order-detail__section"
          aria-labelledby="order-history-title"
        >
          <h2 id="order-history-title">{strings.orderDetail.statusHistory}</h2>
          {order.status_history.length === 0 ? (
            <p>{strings.orderDetail.noStatusHistory}</p>
          ) : (
            <ol className="order-detail__history">
              {order.status_history.map((entry) => (
                <li key={entry.id}>
                  <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
                  <strong>{getAuditDescription(entry.action, entry.payload)}</strong>
                  <span>{entry.actor_name || strings.orderDetail.unknownStaff}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {confirmAction === 'cancel' && (
        <ConfirmAction
          title={`${strings.orders.cancelTitle} ${order.order_no}?`}
          description={strings.orders.cancelDescription}
          confirmLabel={strings.orders.cancel}
          tone="danger"
          requireReason
          onConfirm={async (reason) => {
            await cancelMutation.mutateAsync({ orderId: order.id, reason: reason ?? '' });
            toast.success(strings.orders.cancelSuccess);
            setConfirmAction(null);
          }}
        />
      )}
      {confirmAction === 'return' && (
        <ConfirmAction
          title={`${strings.orders.returnTitle} ${order.order_no}?`}
          description={strings.orders.returnDescription}
          confirmLabel={strings.orders.return}
          tone="danger"
          requireReason
          requireTypedText={order.order_no}
          onConfirm={async (reason) => {
            await returnMutation.mutateAsync({ orderId: order.id, reason: reason ?? '' });
            toast.success(strings.orders.returned);
            setConfirmAction(null);
          }}
        />
      )}
    </main>
  );
}
