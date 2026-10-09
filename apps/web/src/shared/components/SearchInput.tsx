import { useCallback } from 'react';
import { strings } from '../strings/id';

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}): JSX.Element {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  return (
    <div className="search-input">
      <label htmlFor="search-input" className="visually-hidden">
        {placeholder ?? strings.common.loading}
      </label>
      <input
        id="search-input"
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={placeholder ?? strings.pos.search}
        className="search-input__field"
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          className="search-input__clear"
          onClick={() => onChange('')}
          aria-label="Hapus pencarian"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
