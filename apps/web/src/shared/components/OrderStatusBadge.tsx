import { Bell, Check, CircleDot, Flame, X } from 'lucide-react';
import type { OrderStatus } from '../../features/orders';
import { strings } from '../strings/id';

const statusLabels: Record<OrderStatus, string> = {
  new: strings.orders.new,
  processing: strings.orders.processing,
  ready: strings.orders.ready,
  completed: strings.orders.completed,
  cancelled: strings.orders.cancelled,
};

const statusIcons = {
  new: CircleDot,
  processing: Flame,
  ready: Bell,
  completed: Check,
  cancelled: X,
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const Icon = statusIcons[status];
  return (
    <span
      className={`order-status order-status--${status}`}
      aria-label={`${strings.orders.title}: ${statusLabels[status]}`}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{statusLabels[status]}</span>
    </span>
  );
}
