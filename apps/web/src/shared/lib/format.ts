import { format, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

const TIME_ZONE = 'Asia/Jakarta';

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

export function formatPercent(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value / 100);
}

export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return format(d, 'd MMM yyyy', { locale: id, timeZone: TIME_ZONE });
}

export function formatDateTime(date: Date | string | number): string {
  const d = new Date(date);
  return format(d, 'd MMM yyyy, HH:mm', { locale: id, timeZone: TIME_ZONE });
}

export function formatTime(date: Date | string | number): string {
  const d = new Date(date);
  return format(d, 'HH:mm', { timeZone: TIME_ZONE });
}

export function formatRelativeTime(date: Date | string | number): string {
  const d = new Date(date);
  return formatDistanceToNow(d, { addSuffix: true, locale: id });
}

export function formatOrderNumber(value: string): string {
  return value;
}

export function formatAccountNumberList(value: string): string {
  const digits = value.replace(/\D/g, '');
  const last4 = digits.slice(-4);
  return `•••• ${last4}`;
}

export function formatAccountNumberDetail(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}
