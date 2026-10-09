import { useState } from 'react';
import { strings } from '../strings/id';

type MoneyFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  autoFocus?: boolean;
};

const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function MoneyField({
  id,
  label,
  value,
  onChange,
  min = 0,
  autoFocus = false,
}: MoneyFieldProps) {
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, '');
  const displayValue = focused || !digits ? digits : numberFormatter.format(Number(digits));

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="money-field">
        <span aria-hidden="true">Rp</span>
        <input
          autoFocus={autoFocus}
          id={id}
          inputMode="numeric"
          min={min}
          type="text"
          value={displayValue}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
          aria-label={`${label}, ${strings.common.rupiah}`}
        />
      </div>
    </div>
  );
}
