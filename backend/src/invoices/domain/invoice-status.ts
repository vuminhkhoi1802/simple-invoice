/** Statuses that may be written to the database. */
export enum PersistedInvoiceStatus {
  Draft = 'Draft',
  Pending = 'Pending',
  Paid = 'Paid',
}

/** Statuses exposed by the API. `Overdue` is derived at read time and never stored. */
export enum InvoiceStatus {
  Draft = 'Draft',
  Pending = 'Pending',
  Paid = 'Paid',
  Overdue = 'Overdue',
}

/**
 * Overdue rule from the spec:
 *   status != Paid AND dueDate < today  ->  Overdue
 *   otherwise                           ->  persisted status
 *
 * Dates are compared as YYYY-MM-DD strings, which sort lexicographically,
 * so no timezone conversion happens here; "today" is resolved by ClockService.
 */
export function deriveInvoiceStatus(
  persisted: PersistedInvoiceStatus,
  dueDate: string,
  today: string,
): InvoiceStatus {
  if (persisted !== PersistedInvoiceStatus.Paid && dueDate < today) {
    return InvoiceStatus.Overdue;
  }
  return persisted as unknown as InvoiceStatus;
}
