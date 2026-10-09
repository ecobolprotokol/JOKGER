import type { ReactNode } from 'react';

type MoneyProps = {
  value: number;
  tone?: 'default' | 'danger' | 'success';
  signed?: boolean;
};

const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function Money({ value, tone = 'default', signed = false }: MoneyProps): ReactNode {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError('Nilai uang harus berupa bilangan bulat rupiah.');
  }

  const displayValue =
    signed && value < 0 ? `−${formatter.format(Math.abs(value))}` : formatter.format(value);
  return <span className={`money money--${tone}`}>{displayValue}</span>;
}
