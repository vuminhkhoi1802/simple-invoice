import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authApi } from '../api/auth';
import { invoicesApi } from '../api/invoices';
import { renderWithProviders, summary } from '../test/utils';
import { InvoiceListPage } from './InvoiceListPage';

vi.mock('../api/auth', () => ({ authApi: { login: vi.fn(), me: vi.fn(), logout: vi.fn() } }));
vi.mock('../api/invoices', () => ({ invoicesApi: { list: vi.fn(), get: vi.fn(), create: vi.fn() } }));

const page = (data = [summary()], total = data.length, pageNo = 1, pageSize = 10) => ({
  data,
  paging: { page: pageNo, pageSize, total, totalPages: Math.ceil(total / pageSize) },
});

describe('InvoiceListPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockResolvedValue({ id: 'u1', email: 'a@b.co', fullname: 'A', createdAt: '' });
  });

  it('renders the key fields for each invoice', async () => {
    vi.mocked(invoicesApi.list).mockResolvedValue(page());
    renderWithProviders(<InvoiceListPage />, { route: '/invoices', path: '/invoices' });

    const row = (await screen.findByRole('link', { name: 'IV1780488206995' })).closest('tr')!;
    expect(within(row).getByText('Paul')).toBeInTheDocument();
    expect(within(row).getByText('03 Jun 2026')).toBeInTheDocument();
    expect(within(row).getByText('03 Jul 2026')).toBeInTheDocument();
    expect(within(row).getByText('AU$2,180.00')).toBeInTheDocument();
    expect(within(row).getByText('Overdue')).toBeInTheDocument();
    expect(invoicesApi.list).toHaveBeenCalledWith({ page: 1, pageSize: 10, sortBy: 'invoiceDate', ordering: 'DESC' });
  });

  it('sends debounced keyword, status filter and sort to the server and syncs the URL', async () => {
    vi.mocked(invoicesApi.list).mockResolvedValue(page());
    renderWithProviders(<InvoiceListPage />, { route: '/invoices', path: '/invoices' });
    await screen.findByText('IV1780488206995');

    await userEvent.type(screen.getByLabelText('Search'), 'paul');
    await waitFor(() =>
      expect(invoicesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: 'paul', page: 1 })),
    );

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Paid');
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'totalAmount:ASC');
    await waitFor(() =>
      expect(invoicesApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'paul', status: 'Paid', sortBy: 'totalAmount', ordering: 'ASC' }),
      ),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('status=Paid');
  });

  it('paginates server-side', async () => {
    vi.mocked(invoicesApi.list).mockImplementation(async (p) => page([summary({ invoiceNumber: `P${p.page}` })], 25, p.page));
    renderWithProviders(<InvoiceListPage />, { route: '/invoices', path: '/invoices' });

    expect(await screen.findByText('P1')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(await screen.findByText('P2')).toBeInTheDocument();
    expect(invoicesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('restores filters from the URL', async () => {
    vi.mocked(invoicesApi.list).mockResolvedValue(page());
    renderWithProviders(<InvoiceListPage />, {
      route: '/invoices?status=Overdue&page=2&pageSize=20&sortBy=dueDate&ordering=ASC&keyword=iv17',
      path: '/invoices',
    });
    await screen.findByText('IV1780488206995');
    expect(invoicesApi.list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      sortBy: 'dueDate',
      ordering: 'ASC',
      status: 'Overdue',
      keyword: 'iv17',
    });
    expect(screen.getByLabelText('Search')).toHaveValue('iv17');
  });

  it('shows an empty state with a way to clear filters', async () => {
    vi.mocked(invoicesApi.list).mockResolvedValue(page([], 0));
    renderWithProviders(<InvoiceListPage />, { route: '/invoices?status=Paid', path: '/invoices' });
    expect(await screen.findByText('No invoices match your search or filter.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/invoices$/));
  });
});
