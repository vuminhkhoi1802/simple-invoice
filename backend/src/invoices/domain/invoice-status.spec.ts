import { deriveInvoiceStatus, InvoiceStatus, PersistedInvoiceStatus } from './invoice-status';

const TODAY = '2026-06-15';

describe('deriveInvoiceStatus', () => {
  it.each([
    [PersistedInvoiceStatus.Pending, '2026-06-14', InvoiceStatus.Overdue],
    [PersistedInvoiceStatus.Draft, '2026-01-01', InvoiceStatus.Overdue],
    [PersistedInvoiceStatus.Paid, '2026-01-01', InvoiceStatus.Paid],
    [PersistedInvoiceStatus.Pending, '2026-06-15', InvoiceStatus.Pending],
    [PersistedInvoiceStatus.Draft, '2026-06-16', InvoiceStatus.Draft],
    [PersistedInvoiceStatus.Paid, '2026-12-31', InvoiceStatus.Paid],
  ])('%s due %s -> %s', (persisted, due, expected) => {
    expect(deriveInvoiceStatus(persisted, due, TODAY)).toBe(expected);
  });

  it('treats an invoice due today as not yet overdue', () => {
    expect(deriveInvoiceStatus(PersistedInvoiceStatus.Pending, TODAY, TODAY)).toBe(
      InvoiceStatus.Pending,
    );
  });

  it('compares across year boundaries correctly', () => {
    expect(deriveInvoiceStatus(PersistedInvoiceStatus.Pending, '2025-12-31', '2026-01-01')).toBe(
      InvoiceStatus.Overdue,
    );
  });
});
