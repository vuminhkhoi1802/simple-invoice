import { calculateInvoiceTotals } from '../../invoices/domain/invoice-calculator';
import { PersistedInvoiceStatus } from '../../invoices/domain/invoice-status';
import { APPENDIX_A_INVOICE, generateInvoices } from './seed-data';

describe('seed data', () => {
  const today = '2026-11-22';
  const invoices = generateInvoices(today, 40);

  it('is deterministic', () => {
    expect(generateInvoices(today, 40)).toEqual(invoices);
  });

  it('never stores Overdue and covers every persisted status', () => {
    const statuses = new Set(invoices.map((i) => i.status));
    expect(statuses).toEqual(new Set(Object.values(PersistedInvoiceStatus)));
    expect(APPENDIX_A_INVOICE.status).toBe(PersistedInvoiceStatus.Pending);
  });

  it('produces unique invoice numbers and valid date ranges', () => {
    expect(new Set(invoices.map((i) => i.invoiceNumber)).size).toBe(40);
    for (const inv of invoices) expect(inv.dueDate >= inv.invoiceDate).toBe(true);
  });

  it('includes both overdue-eligible and future-due invoices', () => {
    const unpaid = invoices.filter((i) => i.status !== PersistedInvoiceStatus.Paid);
    expect(unpaid.some((i) => i.dueDate < today)).toBe(true);
    expect(unpaid.some((i) => i.dueDate >= today)).toBe(true);
  });

  it('reproduces Appendix A totals', () => {
    const base = calculateInvoiceTotals({
      items: [APPENDIX_A_INVOICE.item],
      taxRate: APPENDIX_A_INVOICE.taxRate,
      discount: APPENDIX_A_INVOICE.discount,
    });
    expect(base.totalAmount).toBe(2180);
    expect(Math.round(base.totalAmount * APPENDIX_A_INVOICE.paidRatio * 100) / 100).toBe(1451.34);
  });
});
