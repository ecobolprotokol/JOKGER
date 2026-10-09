import { useState, useMemo } from 'react';
import { strings } from '../strings/id';

type Column<T> = {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
};

type SortConfig<T> = {
  key: keyof T | string;
  direction: 'asc' | 'desc';
} | null;

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  getRowId,
  sort: initialSort = null,
  selection,
  empty,
  loading,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  sort?: SortConfig<T>;
  selection?: {
    selectedIds: Set<string>;
    onChange: (ids: Set<string>) => void;
    getRowId: (row: T) => string;
  };
  empty?: React.ReactNode;
  loading?: boolean;
}): JSX.Element {
  const [sort, setSort] = useState<SortConfig<T>>(initialSort);
  const [isMobile] = useState(false);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sort.key];
      const bVal = b[sort.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const direction = sort.direction === 'asc' ? 1 : -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal, 'id-ID') * direction;
      }
      return (Number(aVal) - Number(bVal)) * direction;
    });
  }, [rows, sort]);

  const handleSort = (key: string) => {
    const column = columns.find((c) => c.key === key);
    if (!column?.sortable) return;
    setSort((prev) => {
      if (prev?.key === key && prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const toggleSelectAll = () => {
    if (selection) {
      const allIds = new Set(rows.map(selection.getRowId));
      const newSelected = selection.selectedIds.size === rows.length ? new Set<string>() : allIds;
      selection.onChange(newSelected);
    }
  };

  const toggleRow = (id: string) => {
    if (selection) {
      const newSelected = new Set(selection.selectedIds);
      if (newSelected.has(id)) {
        // eslint-disable-next-line no-restricted-syntax
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      selection.onChange(newSelected);
    }
  };

  if (loading) {
    return (
      <div className="datatable-loading" role="status" aria-label={strings.common.loading}>
        <div className="datatable-skeleton">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="datatable-skeleton-row">
              {columns.map((col) => (
                <div
                  key={col.key}
                  className="datatable-skeleton-cell"
                  style={{ width: col.width }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sortedRows.length === 0) {
    return (
      <div className="datatable-empty" role="status">
        {empty ?? strings.common.unknownError}
      </div>
    );
  }

  return (
    <div className="datatable-container">
      <div className="datatable-wrapper" role="region" aria-label="Tabel data">
        <table className="datatable">
          <thead>
            <tr>
              {selection && (
                <th className="datatable-th datatable-th--checkbox" style={{ width: '44px' }}>
                  <input
                    type="checkbox"
                    checked={selection.selectedIds.size === rows.length && rows.length > 0}
                    onChange={toggleSelectAll}
                    aria-label="Pilih semua"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`datatable-th ${column.sortable ? 'datatable-th--sortable' : ''} ${column.align ? `datatable-th--${column.align}` : ''}`}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                  aria-sort={
                    sort?.key === column.key
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <span className="datatable-th__content">
                    {column.header}
                    {column.sortable && sort?.key === column.key && (
                      <span className="datatable-sort-icon" aria-hidden="true">
                        {sort.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => (
              <tr key={getRowId(row)} className="datatable-tr">
                {selection && (
                  <td className="datatable-td datatable-td--checkbox">
                    <input
                      type="checkbox"
                      checked={selection.selectedIds.has(selection.getRowId(row))}
                      onChange={() => toggleRow(selection.getRowId(row))}
                      aria-label={`Pilih baris ${index + 1}`}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`datatable-td ${column.align ? `datatable-td--${column.align}` : ''}`}
                    style={{ width: column.width }}
                  >
                    {column.render ? column.render(row, index) : String(row[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="datatable-mobile" aria-hidden={!isMobile}>
        {sortedRows.map((row, index) => (
          <div key={getRowId(row)} className="datatable-card">
            {columns.map((column) => (
              <div key={column.key} className="datatable-card__field">
                <span className="datatable-card__label">{column.header}</span>
                <span className="datatable-card__value">
                  {column.render ? column.render(row, index) : String(row[column.key] ?? '')}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
