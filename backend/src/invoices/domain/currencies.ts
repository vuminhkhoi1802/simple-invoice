/**
 * Supported ISO 4217 currencies and their display symbols.
 * Restricted to 2-minor-unit currencies because amounts are stored as NUMERIC(14,2);
 * supporting JPY/VND etc. would need per-currency precision.
 */
export const CURRENCY_SYMBOLS = {
  AUD: 'AU$',
  USD: 'US$',
  GBP: '£',
  EUR: '€',
  SGD: 'S$',
  NZD: 'NZ$',
  CAD: 'CA$',
} as const;

export type CurrencyCode = keyof typeof CURRENCY_SYMBOLS;

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_SYMBOLS) as CurrencyCode[];

export function currencySymbol(code: CurrencyCode): string {
  return CURRENCY_SYMBOLS[code];
}
