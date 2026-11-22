import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { authApi } from '../api/auth';
import { ApiError } from '../api/client';
import { invoicesApi } from '../api/invoices';
import { detail, renderWithProviders } from '../test/utils';
import { CreateInvoicePage } from './CreateInvoicePage';

vi.mock('../api/auth', () => ({ authApi: { login: vi.fn(), me: vi.fn(), logout: vi.fn() } }));
vi.mock('../api/invoices', () => ({ invoicesApi: { list: vi.fn(), get: vi.fn(), create: vi.fn() } }));

function renderPage() {
  return renderWithProviders(<CreateInvoicePage />, {
    route: '/invoices/new',
    path: '/invoices/new',
    extraRoutes: <Route path="/invoices" element={<p>Invoice list</p>} />,
  });
}

async function fillValidForm() {
  await userEvent.type(screen.getByLabelText(/customer name/i), 'Paul');
  await userEvent.type(screen.getByLabelText(/customer email/i), 'paul@101digital.io');
  await userEvent.type(screen.getByLabelText(/invoice number/i), 'INV-2026-0042');
  await userEvent.clear(screen.getByLabelText(/invoice date/i));
  await userEvent.type(screen.getByLabelText(/invoice date/i), '2026-06-03');
  await userEvent.clear(screen.getByLabelText(/due date/i));
  await userEvent.type(screen.getByLabelText(/due date/i), '2026-07-03');
  await userEvent.type(screen.getByLabelText(/item name/i), 'Honda RC150');
  await userEvent.clear(screen.getByLabelText(/quantity/i));
  await userEvent.type(screen.getByLabelText(/quantity/i), '2');
  await userEvent.type(screen.getByLabelText(/^rate/i), '1000');
  await userEvent.clear(screen.getByLabelText(/discount/i));
  await userEvent.type(screen.getByLabelText(/discount/i), '20');
}

describe('CreateInvoicePage', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockResolvedValue({ id: 'u1', email: 'a@b.co', fullname: 'A', createdAt: '' });
  });

  it('shows required-field errors and does not submit', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /create invoice/i }));

    expect(await screen.findByText('Customer name is required')).toBeInTheDocument();
    expect(screen.getByText('Customer email is required')).toBeInTheDocument();
    expect(screen.getByText('Invoice number is required')).toBeInTheDocument();
    expect(screen.getByText('Item name is required')).toBeInTheDocument();
    expect(screen.getByText('Rate must be a number')).toBeInTheDocument();
    expect(invoicesApi.create).not.toHaveBeenCalled();
  });

  it('rejects a due date before the invoice date', async () => {
    renderPage();
    await fillValidForm();
    await userEvent.clear(screen.getByLabelText(/due date/i));
    await userEvent.type(screen.getByLabelText(/due date/i), '2026-06-01');
    await userEvent.click(screen.getByRole('button', { name: /create invoice/i }));

    expect(await screen.findByText('Due date must be on or after the invoice date')).toBeInTheDocument();
    expect(invoicesApi.create).not.toHaveBeenCalled();
  });

  it('rejects non-positive quantity and rate', async () => {
    renderPage();
    await fillValidForm();
    await userEvent.clear(screen.getByLabelText(/quantity/i));
    await userEvent.type(screen.getByLabelText(/quantity/i), '0');
    await userEvent.clear(screen.getByLabelText(/^rate/i));
    await userEvent.type(screen.getByLabelText(/^rate/i), '-5');
    await userEvent.click(screen.getByRole('button', { name: /create invoice/i }));

    expect(await screen.findByText('Quantity must be greater than 0')).toBeInTheDocument();
    expect(screen.getByText('Rate must be greater than 0')).toBeInTheDocument();
  });

  it('submits the payload (no client-side totals), toasts, and redirects to the list', async () => {
    vi.mocked(invoicesApi.create).mockResolvedValue(detail({ invoiceNumber: 'INV-2026-0042' }));
    renderPage();
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: /create invoice/i }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/invoices'));
    expect(await screen.findByText('Invoice INV-2026-0042 created')).toBeInTheDocument();
    expect(vi.mocked(invoicesApi.create).mock.calls[0][0]).toEqual({
      invoiceNumber: 'INV-2026-0042',
      invoiceReference: undefined,
      invoiceDate: '2026-06-03',
      dueDate: '2026-07-03',
      currency: 'AUD',
      description: undefined,
      customer: { fullname: 'Paul', email: 'paul@101digital.io', mobileNumber: undefined, address: undefined },
      items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
      taxRate: 10,
      discount: 20,
    });
  });

  it('maps a 409 conflict onto the invoice number field', async () => {
    vi.mocked(invoicesApi.create).mockRejectedValue(new ApiError(409, ['Invoice number "X" already exists']));
    renderPage();
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: /create invoice/i }));

    expect(await screen.findByText('This invoice number is already in use')).toBeInTheDocument();
    expect(screen.getByLabelText(/invoice number/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('location')).toHaveTextContent('/invoices/new');
  });

  it('lists server validation messages', async () => {
    vi.mocked(invoicesApi.create).mockRejectedValue(
      new ApiError(400, ['discount must not exceed subtotal plus tax']),
    );
    renderPage();
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: /create invoice/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('discount must not exceed subtotal plus tax');
  });
});
