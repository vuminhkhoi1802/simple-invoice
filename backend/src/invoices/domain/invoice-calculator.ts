import Decimal from 'decimal.js';

export interface InvoiceLineInput {
  quantity: number;
  rate: number;
}

export interface InvoiceTotalsInput {
  items: InvoiceLineInput[];
  /** Percentage, e.g. 10 for 10%. */
  taxRate: number;
  /** Absolute amount in invoice currency. */
  discount: number;
  totalPaid?: number;
}

export interface InvoiceTotals {
  invoiceSubTotal: number;
  totalTax: number;
  totalDiscount: number;
  totalAmount: number;
  totalPaid: number;
  balanceAmount: number;
}

export class InvoiceCalculationError extends Error {}

const toMoney = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

/**
 * Server-side invoice maths (spec 2.3.2):
 *   subTotal      = Σ quantity × rate
 *   taxAmount     = subTotal × (tax% / 100)
 *   totalAmount   = subTotal + taxAmount − discount
 *   balanceAmount = totalAmount − totalPaid
 *
 * Uses arbitrary-precision decimals so 0.1 + 0.2 style float errors never reach
 * stored amounts; each figure is rounded half-up to 2 d.p. *before* it feeds the
 * next one, so the persisted parts always add up exactly to the persisted total.
 */
export function calculateInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  if (input.items.length === 0) {
    throw new InvoiceCalculationError('An invoice must contain at least one item');
  }
  if (input.taxRate < 0) throw new InvoiceCalculationError('tax must not be negative');
  if (input.discount < 0) throw new InvoiceCalculationError('discount must not be negative');

  const subTotal = input.items
    .reduce((sum, item) => sum.plus(new Decimal(item.quantity).times(item.rate)), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const tax = subTotal
    .times(new Decimal(input.taxRate).dividedBy(100))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const discount = new Decimal(input.discount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const total = subTotal.plus(tax).minus(discount);

  if (total.isNegative()) {
    throw new InvoiceCalculationError('discount must not exceed subtotal plus tax');
  }

  const paid = new Decimal(input.totalPaid ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return {
    invoiceSubTotal: toMoney(subTotal),
    totalTax: toMoney(tax),
    totalDiscount: toMoney(discount),
    totalAmount: toMoney(total),
    totalPaid: toMoney(paid),
    balanceAmount: toMoney(total.minus(paid)),
  };
}
