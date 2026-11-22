import { http, toApiError } from './client';
import type { CreateInvoicePayload, InvoiceDetail, InvoiceListParams, InvoiceListResponse } from './types';

/** Drops empty values so the URL and the backend only see filters actually in use. */
function cleanParams(params: InvoiceListParams): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Record<string, string | number>;
}

export const invoicesApi = {
  async list(params: InvoiceListParams): Promise<InvoiceListResponse> {
    try {
      return (await http.get<InvoiceListResponse>('/invoices', { params: cleanParams(params) })).data;
    } catch (e) {
      throw toApiError(e);
    }
  },

  async get(id: string): Promise<InvoiceDetail> {
    try {
      return (await http.get<InvoiceDetail>(`/invoices/${encodeURIComponent(id)}`)).data;
    } catch (e) {
      throw toApiError(e);
    }
  },

  async create(payload: CreateInvoicePayload): Promise<InvoiceDetail> {
    try {
      return (await http.post<InvoiceDetail>('/invoices', payload)).data;
    } catch (e) {
      throw toApiError(e);
    }
  },
};
