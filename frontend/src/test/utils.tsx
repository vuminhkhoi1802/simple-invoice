import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { InvoiceDetail, InvoiceSummary } from '../api/types';
import { AppProviders } from '../providers';

/** Exposes the current URL so tests can assert on navigation. */
export function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path = '/', extraRoutes }: { route?: string; path?: string; extraRoutes?: ReactElement } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppProviders client={client}>
        <Routes>
          <Route path={path} element={ui} />
          {extraRoutes}
        </Routes>
        <LocationProbe />
      </AppProviders>
    </MemoryRouter>,
  );
}

export const summary = (overrides: Partial<InvoiceSummary> = {}): InvoiceSummary => ({
  invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  invoiceNumber: 'IV1780488206995',
  customerName: 'Paul',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  currencySymbol: 'AU$',
  totalAmount: 2180,
  balanceAmount: 728.66,
  status: 'Overdue',
  ...overrides,
});

export const detail = (overrides: Partial<InvoiceDetail> = {}): InvoiceDetail => ({
  invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  invoiceNumber: 'IV1780488206995',
  invoiceReference: '#5721662',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  currencySymbol: 'AU$',
  description: 'Invoice is issued to Kanglee',
  status: 'Overdue',
  customer: { fullname: 'Paul', email: 'paul@101digital.io', mobileNumber: '947717364111', address: 'Singapore' },
  items: [{ id: 'item-1', name: 'Honda RC150', quantity: 2, rate: 1000, amount: 2000 }],
  taxRate: 10,
  invoiceSubTotal: 2000,
  totalTax: 200,
  totalDiscount: 20,
  totalAmount: 2180,
  totalPaid: 1451.34,
  balanceAmount: 728.66,
  createdAt: '2026-06-03T12:03:26.995Z',
  createdBy: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  ...overrides,
});
