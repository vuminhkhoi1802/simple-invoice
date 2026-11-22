import { CurrencyCode } from '../../invoices/domain/currencies';
import { PersistedInvoiceStatus } from '../../invoices/domain/invoice-status';
import { addDays } from '../../common/utils/date';

/** Id taken from Appendix A's `createdBy` so the mock record links to a real user. */
export const DEFAULT_USER_ID = 'ad1e0902-1928-4345-b513-60c86c94fc91';

export interface SeedInvoice {
  id?: string;
  invoiceNumber: string;
  invoiceReference?: string;
  invoiceDate: string;
  dueDate: string;
  currency: CurrencyCode;
  description?: string;
  status: PersistedInvoiceStatus;
  customer: { fullname: string; email: string; mobileNumber?: string; address?: string };
  item: { id?: string; name: string; quantity: number; rate: number };
  taxRate: number;
  discount: number;
  /** Fraction of the total already paid (0..1); Paid invoices are always 1. */
  paidRatio: number;
  createdAt?: Date;
}

/**
 * Appendix A record, verbatim except `status`: the mock shows "Overdue", which is a
 * derived status and must never be stored, so it is persisted as Pending (it has a
 * partial payment and its due date has passed, so it reads back as Overdue).
 */
export const APPENDIX_A_INVOICE: SeedInvoice = {
  id: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  invoiceNumber: 'IV1780488206995',
  invoiceReference: '#5721662',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  description: 'Invoice is issued to Kanglee',
  status: PersistedInvoiceStatus.Pending,
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  item: { id: 'b1c2d3e4-0000-0000-0000-000000000001', name: 'Honda RC150', quantity: 2, rate: 1000 },
  taxRate: 10,
  discount: 20,
  // 1451.34 / 2180.00 — reproduces the mock's totalPaid exactly after rounding.
  paidRatio: 1451.34 / 2180,
  createdAt: new Date('2026-06-03T12:03:26.995Z'),
};

const CUSTOMERS = [
  { fullname: 'Alice Nguyen', address: 'Ho Chi Minh City, Vietnam' },
  { fullname: 'Bob Tanaka', address: 'Osaka, Japan' },
  { fullname: 'Charlotte Smith', address: 'Sydney, Australia' },
  { fullname: 'David Lim', address: 'Singapore' },
  { fullname: 'Emma Brown', address: 'London, United Kingdom' },
  { fullname: 'Farhan Rahman', address: 'Kuala Lumpur, Malaysia' },
  { fullname: 'Grace Lee', address: 'Seoul, South Korea' },
  { fullname: 'Hiroshi Sato', address: 'Tokyo, Japan' },
  { fullname: 'Isabella Rossi', address: 'Milan, Italy' },
  { fullname: 'Jack Wilson', address: 'Melbourne, Australia' },
  { fullname: 'Kanglee Holdings', address: 'Singapore' },
  { fullname: 'Linh Tran', address: 'Hanoi, Vietnam' },
  { fullname: 'Mohammed Ali', address: 'Dubai, UAE' },
  { fullname: 'Nora Jensen', address: 'Copenhagen, Denmark' },
  { fullname: 'Oliver Chen', address: 'Auckland, New Zealand' },
  { fullname: 'Priya Sharma', address: 'Bangalore, India' },
];

const PRODUCTS = [
  { name: 'Website maintenance (monthly)', min: 300, max: 1500 },
  { name: 'Cloud hosting plan', min: 50, max: 400 },
  { name: 'UX design workshop', min: 1200, max: 4800 },
  { name: 'Mobile app license', min: 20, max: 120 },
  { name: 'Consulting hours', min: 90, max: 250 },
  { name: 'Honda RC150', min: 900, max: 1200 },
  { name: 'Laptop - 14" Pro', min: 1500, max: 3200 },
  { name: 'Office chairs', min: 120, max: 450 },
  { name: 'Security audit', min: 2500, max: 9000 },
  { name: 'Printer toner', min: 25, max: 90 },
];

const CURRENCIES: CurrencyCode[] = ['AUD', 'AUD', 'AUD', 'USD', 'USD', 'SGD', 'GBP', 'EUR'];
const TAX_RATES = [10, 10, 10, 0, 5, 7, 15];
const PAYMENT_TERMS_DAYS = [0, 7, 14, 30, 30, 45, 60];

/** Small deterministic PRNG (mulberry32) so every reviewer gets identical seed data. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates `count` varied invoices. Dates are relative to `today` so a fresh seed always
 * yields a realistic mix of upcoming, due-today and overdue invoices whenever it is run.
 */
export function generateInvoices(today: string, count = 40): SeedInvoice[] {
  const rand = rng(20260603);
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const pick = <T>(arr: readonly T[]): T => arr[int(0, arr.length - 1)];
  const money = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100) / 100;

  return Array.from({ length: count }, (_, i) => {
    const customer = pick(CUSTOMERS);
    const product = pick(PRODUCTS);
    const invoiceDate = addDays(today, -int(0, 180));
    const dueDate = addDays(invoiceDate, pick(PAYMENT_TERMS_DAYS));
    const roll = rand();
    const status =
      roll < 0.35
        ? PersistedInvoiceStatus.Paid
        : roll < 0.75
          ? PersistedInvoiceStatus.Pending
          : PersistedInvoiceStatus.Draft;
    const quantity = int(1, 20);
    const rate = money(product.min, product.max);
    const discount = rand() < 0.5 ? 0 : Math.round(quantity * rate * rand() * 0.05 * 100) / 100;
    const paidRatio =
      status === PersistedInvoiceStatus.Paid
        ? 1
        : status === PersistedInvoiceStatus.Pending && rand() < 0.4
          ? Math.round(rand() * 80) / 100
          : 0;
    const emailLocal = customer.fullname.toLowerCase().replace(/[^a-z]+/g, '.');

    return {
      invoiceNumber: `SI-${String(1001 + i)}`,
      invoiceReference: rand() < 0.5 ? `PO-${int(10000, 99999)}` : undefined,
      invoiceDate,
      dueDate,
      currency: pick(CURRENCIES),
      description: `${product.name} for ${customer.fullname}`,
      status,
      customer: {
        fullname: customer.fullname,
        email: `${emailLocal}@example.com`,
        mobileNumber: rand() < 0.7 ? `+65 ${int(8000, 9999)} ${int(1000, 9999)}` : undefined,
        address: customer.address,
      },
      item: { name: product.name, quantity, rate },
      taxRate: pick(TAX_RATES),
      discount,
      paidRatio,
    };
  });
}
