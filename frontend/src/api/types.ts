/** Mirrors the backend DTOs (see Swagger at /api/docs). */
export type InvoiceStatus = 'Draft' | 'Pending' | 'Paid' | 'Overdue';
export const INVOICE_STATUSES: InvoiceStatus[] = ['Draft', 'Pending', 'Paid', 'Overdue'];

export type SortBy = 'invoiceDate' | 'dueDate' | 'totalAmount';
export type Ordering = 'ASC' | 'DESC';

export const CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR', 'SGD', 'NZD', 'CAD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface UserProfile {
  id: string;
  email: string;
  fullname: string;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserProfile;
}

export interface InvoiceSummary {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  currencySymbol: string;
  totalAmount: number;
  balanceAmount: number;
  status: InvoiceStatus;
}

export interface Paging {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface InvoiceListResponse {
  data: InvoiceSummary[];
  paging: Paging;
}

export interface InvoiceListParams {
  page: number;
  pageSize: number;
  sortBy: SortBy;
  ordering: Ordering;
  status?: InvoiceStatus;
  keyword?: string;
  fromDate?: string;
  toDate?: string;
}

export interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceDetail {
  invoiceId: string;
  invoiceNumber: string;
  invoiceReference: string | null;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  currencySymbol: string;
  description: string | null;
  status: InvoiceStatus;
  customer: {
    fullname: string;
    email: string;
    mobileNumber: string | null;
    address: string | null;
  };
  items: InvoiceItem[];
  taxRate: number;
  invoiceSubTotal: number;
  totalTax: number;
  totalDiscount: number;
  totalAmount: number;
  totalPaid: number;
  balanceAmount: number;
  createdAt: string;
  createdBy: string;
}

export interface CreateInvoicePayload {
  invoiceNumber: string;
  invoiceReference?: string;
  invoiceDate: string;
  dueDate: string;
  currency: Currency;
  description?: string;
  customer: {
    fullname: string;
    email: string;
    mobileNumber?: string;
    address?: string;
  };
  items: Array<{ name: string; quantity: number; rate: number }>;
  taxRate?: number;
  discount?: number;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}
