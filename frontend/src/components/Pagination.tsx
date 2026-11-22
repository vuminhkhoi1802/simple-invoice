import type { Paging } from '../api/types';

interface Props {
  paging: Paging;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ paging, onPageChange, disabled }: Props) {
  const { page, pageSize, total, totalPages } = paging;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-summary">
        {from}–{to} of {total}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
        >
          ‹ Prev
        </button>
        <span className="pagination-page" aria-current="page">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= totalPages}
        >
          Next ›
        </button>
      </div>
    </nav>
  );
}
