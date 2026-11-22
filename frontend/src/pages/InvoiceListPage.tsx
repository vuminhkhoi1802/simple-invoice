import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { invoicesApi } from '../api/invoices';
import { INVOICE_STATUSES, type InvoiceStatus, type Ordering, type SortBy } from '../api/types';
import { ErrorState } from '../components/ErrorState';
import { Pagination } from '../components/Pagination';
import { Spinner } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PAGE_SIZES, useInvoiceListParams } from '../hooks/useInvoiceListParams';
import { formatDate, formatMoney } from '../lib/format';

const SORT_OPTIONS: Array<{ value: `${SortBy}:${Ordering}`; label: string }> = [
  { value: 'invoiceDate:DESC', label: 'Invoice date (newest)' },
  { value: 'invoiceDate:ASC', label: 'Invoice date (oldest)' },
  { value: 'dueDate:ASC', label: 'Due date (soonest)' },
  { value: 'dueDate:DESC', label: 'Due date (latest)' },
  { value: 'totalAmount:DESC', label: 'Total amount (high → low)' },
  { value: 'totalAmount:ASC', label: 'Total amount (low → high)' },
];

export function InvoiceListPage() {
  const navigate = useNavigate();
  const { params, update } = useInvoiceListParams();

  // Local input state, debounced into the URL so we don't fire a request per keystroke.
  const [keywordInput, setKeywordInput] = useState(params.keyword ?? '');
  const debouncedKeyword = useDebouncedValue(keywordInput.trim(), 350);
  useEffect(() => {
    if ((params.keyword ?? '') !== debouncedKeyword) update({ keyword: debouncedKeyword || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKeyword]);

  const query = useQuery({
    queryKey: ['invoices', params],
    queryFn: () => invoicesApi.list(params),
    placeholderData: keepPreviousData,
  });

  const hasFilters = Boolean(params.keyword || params.status);
  const rows = query.data?.data ?? [];

  return (
    <section>
      <div className="page-header">
        <h1>Invoices</h1>
        <Link to="/invoices/new" className="btn btn-primary">
          + New invoice
        </Link>
      </div>

      <div className="card toolbar" role="search">
        <div className="field toolbar-search">
          <label htmlFor="keyword">Search</label>
          <input
            id="keyword"
            type="search"
            placeholder="Invoice number or customer name"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            maxLength={100}
          />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={params.status ?? ''}
            onChange={(e) => update({ status: (e.target.value || undefined) as InvoiceStatus | undefined })}
          >
            <option value="">All statuses</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select
            id="sort"
            value={`${params.sortBy}:${params.ordering}`}
            onChange={(e) => {
              const [sortBy, ordering] = e.target.value.split(':') as [SortBy, Ordering];
              update({ sortBy, ordering });
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pageSize">Per page</label>
          <select
            id="pageSize"
            value={params.pageSize}
            onChange={(e) => update({ pageSize: Number(e.target.value) })}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {query.isError ? (
        <ErrorState messages={(query.error as Error).message.split('\n')} onRetry={() => query.refetch()} />
      ) : query.isPending ? (
        <div className="card center-block">
          <Spinner label="Loading invoices" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card empty-state">
          <p>{hasFilters ? 'No invoices match your search or filter.' : 'No invoices yet.'}</p>
          {hasFilters ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setKeywordInput('');
                update({ keyword: undefined, status: undefined });
              }}
            >
              Clear filters
            </button>
          ) : (
            <Link to="/invoices/new" className="btn btn-primary">
              Create your first invoice
            </Link>
          )}
        </div>
      ) : (
        <div className={`card table-card${query.isFetching ? ' is-fetching' : ''}`} aria-busy={query.isFetching}>
          <table className="invoice-table">
            <thead>
              <tr>
                <th scope="col">Invoice #</th>
                <th scope="col">Customer</th>
                <th scope="col">Invoice date</th>
                <th scope="col">Due date</th>
                <th scope="col" className="num">
                  Total
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr
                  key={inv.invoiceId}
                  className="clickable-row"
                  onClick={() => navigate(`/invoices/${inv.invoiceId}`)}
                >
                  <td data-label="Invoice #">
                    <Link to={`/invoices/${inv.invoiceId}`} onClick={(e) => e.stopPropagation()}>
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td data-label="Customer">{inv.customerName}</td>
                  <td data-label="Invoice date">{formatDate(inv.invoiceDate)}</td>
                  <td data-label="Due date">{formatDate(inv.dueDate)}</td>
                  <td data-label="Total" className="num">
                    {formatMoney(inv.totalAmount, inv.currencySymbol)}
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {query.data && (
            <Pagination
              paging={query.data.paging}
              onPageChange={(page) => update({ page })}
              disabled={query.isFetching}
            />
          )}
        </div>
      )}
    </section>
  );
}
