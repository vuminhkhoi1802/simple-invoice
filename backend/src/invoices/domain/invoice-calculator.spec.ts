import { calculateInvoiceTotals, InvoiceCalculationError } from './invoice-calculator';

describe('calculateInvoiceTotals', () => {
  it('reproduces the Appendix A example', () => {
    expect(
      calculateInvoiceTotals({
        items: [{ quantity: 2, rate: 1000 }],
        taxRate: 10,
        discount: 20,
        totalPaid: 1451.34,
      }),
    ).toEqual({
      invoiceSubTotal: 2000,
      totalTax: 200,
      totalDiscount: 20,
      totalAmount: 2180,
      totalPaid: 1451.34,
      balanceAmount: 728.66,
    });
  });

  it('defaults totalPaid to 0 so balance equals total for a new invoice', () => {
    const t = calculateInvoiceTotals({ items: [{ quantity: 1, rate: 50 }], taxRate: 10, discount: 0 });
    expect(t.totalPaid).toBe(0);
    expect(t.balanceAmount).toBe(t.totalAmount);
    expect(t.totalAmount).toBe(55);
  });

  it('avoids binary floating point drift', () => {
    // 3 × 0.1 = 0.30000000000000004 in IEEE-754
    const t = calculateInvoiceTotals({ items: [{ quantity: 3, rate: 0.1 }], taxRate: 0, discount: 0 });
    expect(t.invoiceSubTotal).toBe(0.3);
    expect(t.totalAmount).toBe(0.3);
  });

  it('rounds tax half-up to cents', () => {
    // 3 × 33.33 = 99.99; 7.5% of 99.99 = 7.49925 -> 7.50
    const t = calculateInvoiceTotals({ items: [{ quantity: 3, rate: 33.33 }], taxRate: 7.5, discount: 0 });
    expect(t.invoiceSubTotal).toBe(99.99);
    expect(t.totalTax).toBe(7.5);
    expect(t.totalAmount).toBe(107.49);
  });

  it('keeps persisted parts consistent with the total', () => {
    const t = calculateInvoiceTotals({ items: [{ quantity: 7, rate: 19.99 }], taxRate: 12.5, discount: 3.33 });
    expect(Number((t.invoiceSubTotal + t.totalTax - t.totalDiscount).toFixed(2))).toBe(t.totalAmount);
  });

  it('sums multiple line items (model supports more than one)', () => {
    const t = calculateInvoiceTotals({
      items: [
        { quantity: 2, rate: 10 },
        { quantity: 1, rate: 5.5 },
      ],
      taxRate: 0,
      discount: 0,
    });
    expect(t.invoiceSubTotal).toBe(25.5);
  });

  it('allows a discount that zeroes the invoice', () => {
    const t = calculateInvoiceTotals({ items: [{ quantity: 1, rate: 100 }], taxRate: 10, discount: 110 });
    expect(t.totalAmount).toBe(0);
  });

  it('rejects a discount larger than subtotal plus tax', () => {
    expect(() =>
      calculateInvoiceTotals({ items: [{ quantity: 1, rate: 100 }], taxRate: 10, discount: 110.01 }),
    ).toThrow(InvoiceCalculationError);
  });

  it('rejects negative tax, negative discount and empty items', () => {
    expect(() => calculateInvoiceTotals({ items: [{ quantity: 1, rate: 1 }], taxRate: -1, discount: 0 })).toThrow(
      InvoiceCalculationError,
    );
    expect(() => calculateInvoiceTotals({ items: [{ quantity: 1, rate: 1 }], taxRate: 0, discount: -1 })).toThrow(
      InvoiceCalculationError,
    );
    expect(() => calculateInvoiceTotals({ items: [], taxRate: 0, discount: 0 })).toThrow(InvoiceCalculationError);
  });
});
