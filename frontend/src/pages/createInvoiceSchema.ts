import { z } from 'zod';
import { CURRENCIES, type CreateInvoicePayload } from '../api/types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const twoDecimals = (n: number) => Math.round(n * 100) === Number((n * 100).toFixed(6));
const num = (label: string) =>
  z.number({ invalid_type_error: `${label} must be a number`, required_error: `${label} is required` });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((v) => (v ? v : undefined));

/**
 * Client-side validation mirrors the server rules for fast feedback.
 * The server remains the authority (it re-validates and computes all totals).
 */
export const createInvoiceSchema = z
  .object({
    customerName: z.string().trim().min(1, 'Customer name is required').max(255),
    customerEmail: z.string().trim().min(1, 'Customer email is required').email('Enter a valid email address'),
    customerMobile: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || /^\+?[0-9 ()-]{6,20}$/.test(v), 'Enter a valid phone number')
      .transform((v) => (v ? v : undefined)),
    customerAddress: optionalText(500),
    invoiceNumber: z
      .string()
      .trim()
      .min(1, 'Invoice number is required')
      .max(50, 'Must be 50 characters or fewer')
      .regex(/^[A-Za-z0-9][A-Za-z0-9\-_/#.]*$/, 'Use letters, digits and - _ / # . only'),
    invoiceReference: optionalText(100),
    invoiceDate: z.string().regex(ISO_DATE, 'Invoice date is required'),
    dueDate: z.string().regex(ISO_DATE, 'Due date is required'),
    currency: z.enum(CURRENCIES, { errorMap: () => ({ message: 'Select a currency' }) }),
    description: optionalText(2000),
    itemName: z.string().trim().min(1, 'Item name is required').max(255),
    itemQuantity: num('Quantity')
      .int('Quantity must be a whole number')
      .positive('Quantity must be greater than 0')
      .max(1_000_000),
    itemRate: num('Rate')
      .positive('Rate must be greater than 0')
      .refine(twoDecimals, 'Rate can have at most 2 decimal places'),
    taxRate: num('Tax')
      .min(0, 'Tax cannot be negative')
      .max(100, 'Tax cannot exceed 100%')
      .refine(twoDecimals, 'Tax can have at most 2 decimal places'),
    discount: num('Discount')
      .min(0, 'Discount cannot be negative')
      .refine(twoDecimals, 'Discount can have at most 2 decimal places'),
  })
  .refine((v) => !ISO_DATE.test(v.dueDate) || v.dueDate >= v.invoiceDate, {
    path: ['dueDate'],
    message: 'Due date must be on or after the invoice date',
  });

export type CreateInvoiceFormInput = z.input<typeof createInvoiceSchema>;
export type CreateInvoiceFormValues = z.output<typeof createInvoiceSchema>;

export function toCreatePayload(v: CreateInvoiceFormValues): CreateInvoicePayload {
  return {
    invoiceNumber: v.invoiceNumber,
    invoiceReference: v.invoiceReference,
    invoiceDate: v.invoiceDate,
    dueDate: v.dueDate,
    currency: v.currency,
    description: v.description,
    customer: {
      fullname: v.customerName,
      email: v.customerEmail,
      mobileNumber: v.customerMobile,
      address: v.customerAddress,
    },
    items: [{ name: v.itemName, quantity: v.itemQuantity, rate: v.itemRate }],
    taxRate: v.taxRate,
    discount: v.discount,
  };
}
