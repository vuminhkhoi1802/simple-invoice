import { screen } from '@testing-library/react';
import { authApi } from '../api/auth';
import { ApiError } from '../api/client';
import { invoicesApi } from '../api/invoices';
import { detail, renderWithProviders } from '../test/utils';
import { InvoiceDetailPage } from './InvoiceDetailPage';

vi.mock('../api/auth', () => ({ authApi: { login: vi.fn(), me: vi.fn(), logout: vi.fn() } }));
vi.mock('../api/invoices', () => ({ invoicesApi: { list: vi.fn(), get: vi.fn(), create: vi.fn() } }));

const route = { route: '/invoices/099ca7da-a290-40fa-93b9-1c43ae7bb887', path: '/invoices/:id' };

describe('InvoiceDetailPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockResolvedValue({ id: 'u1', email: 'a@b.co', fullname: 'A', createdAt: '' });
  });

  it('shows invoice, customer, line items and all server-calculated totals', async () => {
    vi.mocked(invoicesApi.get).mockResolvedValue(detail());
    renderWithProviders(<InvoiceDetailPage />, route);

    expect(await screen.findByRole('heading', { name: /invoice iv1780488206995/i })).toBeInTheDocument();
    expect(invoicesApi.get).toHaveBeenCalledWith('099ca7da-a290-40fa-93b9-1c43ae7bb887');
    expect(screen.getByText('#5721662')).toBeInTheDocument();
    expect(screen.getByText('paul@101digital.io')).toBeInTheDocument();
    expect(screen.getByText('Honda RC150')).toBeInTheDocument();

    const totals = screen.getByLabelText('Totals');
    for (const text of ['AU$2,000.00', 'AU$200.00', '−AU$20.00', 'AU$2,180.00', 'AU$1,451.34', 'AU$728.66']) {
      expect(totals).toHaveTextContent(text);
    }
    expect(screen.getByText('Tax (10%)')).toBeInTheDocument();
    expect(screen.getByTestId('balance')).toHaveTextContent('AU$728.66');
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
  });

  it('shows a not-found state for a 404', async () => {
    vi.mocked(invoicesApi.get).mockRejectedValue(new ApiError(404, ['Invoice not found']));
    renderWithProviders(<InvoiceDetailPage />, route);
    expect(await screen.findByRole('heading', { name: 'Invoice not found' })).toBeInTheDocument();
  });
});
