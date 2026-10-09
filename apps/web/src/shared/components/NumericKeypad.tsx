export function NumericKeypad({
  onKey,
  onBackspace,
  onClear,
}: {
  onKey: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}): JSX.Element {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['C', '0', '⌫'],
  ];

  return (
    <div className="numeric-keypad" role="application" aria-label="Numeric keypad">
      {keys.map((row, rowIndex) => (
        <div key={rowIndex} className="numeric-keypad__row">
          {row.map((key, keyIndex) => (
            <button
              key={keyIndex}
              className={`numeric-keypad__key ${key === 'C' ? 'numeric-keypad__key--clear' : ''} ${key === '⌫' ? 'numeric-keypad__key--backspace' : ''}`}
              onClick={() => {
                if (key === 'C') onClear();
                else if (key === '⌫') onBackspace();
                else onKey(key);
              }}
              aria-label={key === '⌫' ? 'Hapus' : key === 'C' ? 'Hapus semua' : key}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
