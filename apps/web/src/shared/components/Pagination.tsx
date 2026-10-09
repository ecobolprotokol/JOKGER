import { strings } from '../strings/id';

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number, pageSize: number) => void;
}): JSX.Element {
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label={strings.common.loading}>
      <div className="pagination__info">
        Menampilkan {start}–{end} dari {total}
      </div>
      <div className="pagination__controls">
        <select
          value={pageSize}
          onChange={(e) => onChange(1, Number(e.target.value))}
          className="pagination__size"
          aria-label="Item per halaman"
        >
          {[25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size} per halaman
            </option>
          ))}
        </select>
        <button
          className="button button--secondary pagination__btn"
          onClick={() => onChange(page - 1, pageSize)}
          disabled={page <= 1}
          aria-label="Halaman sebelumnya"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="pagination__page" aria-current="page">
          Halaman {page} dari {totalPages}
        </span>
        <button
          className="button button--secondary pagination__btn"
          onClick={() => onChange(page + 1, pageSize)}
          disabled={page >= totalPages}
          aria-label="Halaman selanjutnya"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
