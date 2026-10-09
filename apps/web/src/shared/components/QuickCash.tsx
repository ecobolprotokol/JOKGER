import { quickCashAmounts } from '../lib/money';
import { Money } from './Money';

export function QuickCash({
  total,
  onPick,
}: {
  total: number;
  onPick: (amount: number) => void;
}): JSX.Element {
  const amounts = quickCashAmounts(total);

  return (
    <div className="quick-cash" role="group" aria-label="Pilihan uang cepat">
      {amounts.map((amount) => (
        <button
          key={amount}
          className="button button--secondary quick-cash__btn"
          onClick={() => onPick(amount)}
        >
          <Money value={amount} />
        </button>
      ))}
    </div>
  );
}
