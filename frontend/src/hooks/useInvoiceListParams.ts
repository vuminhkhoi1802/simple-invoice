import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { INVOICE_STATUSES, type InvoiceListParams, type InvoiceStatus, type Ordering, type SortBy } from '../api/types';

export const PAGE_SIZES = [10, 20, 50] as const;
const SORT_FIELDS: SortBy[] = ['invoiceDate', 'dueDate', 'totalAmount'];

export const DEFAULT_PARAMS: InvoiceListParams = {
  page: 1,
  pageSize: 10,
  sortBy: 'invoiceDate',
  ordering: 'DESC',
};

/**
 * List state lives in the URL (?page=2&status=Paid...) so filters survive refresh,
 * the back button works, and a filtered view can be shared as a link.
 * Unknown/invalid values fall back to defaults instead of producing a 400.
 */
export function useInvoiceListParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<InvoiceListParams>(() => {
    const page = Number(searchParams.get('page'));
    const pageSize = Number(searchParams.get('pageSize'));
    const sortBy = searchParams.get('sortBy') as SortBy | null;
    const ordering = searchParams.get('ordering') as Ordering | null;
    const status = searchParams.get('status') as InvoiceStatus | null;
    return {
      page: Number.isInteger(page) && page > 0 ? page : DEFAULT_PARAMS.page,
      pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_PARAMS.pageSize,
      sortBy: sortBy && SORT_FIELDS.includes(sortBy) ? sortBy : DEFAULT_PARAMS.sortBy,
      ordering: ordering === 'ASC' || ordering === 'DESC' ? ordering : DEFAULT_PARAMS.ordering,
      status: status && INVOICE_STATUSES.includes(status) ? status : undefined,
      keyword: searchParams.get('keyword') || undefined,
    };
  }, [searchParams]);

  /** Merge changes; any change other than the page itself resets to page 1. */
  const update = useCallback(
    (changes: Partial<InvoiceListParams>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === '' || value === null) next.delete(key);
            else next.set(key, String(value));
          }
          if (!('page' in changes)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { params, update };
}
