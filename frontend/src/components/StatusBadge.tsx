import type { InvoiceStatus } from '../api/types';

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>;
}
