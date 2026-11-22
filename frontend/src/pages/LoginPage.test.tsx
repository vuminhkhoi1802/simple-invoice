import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { authApi } from '../api/auth';
import { ApiError } from '../api/client';
import { renderWithProviders } from '../test/utils';
import { LoginPage } from './LoginPage';

vi.mock('../api/auth', () => ({
  authApi: { login: vi.fn(), me: vi.fn(), logout: vi.fn() },
}));

const user = { id: 'u1', email: 'admin@simpleinvoice.dev', fullname: 'Demo Admin', createdAt: '' };

function renderLogin() {
  return renderWithProviders(<LoginPage />, {
    route: '/login',
    path: '/login',
    extraRoutes: <Route path="/invoices" element={<p>Invoice list</p>} />,
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiError(401, ['Authentication required']));
  });

  it('renders the sign-in form inside a main landmark', async () => {
    renderLogin();
    const main = await screen.findByRole('main');
    expect(main).toContainElement(screen.getByRole('button', { name: /sign in/i }));
  });

  it('validates email and password on the client before calling the API', async () => {
    renderLogin();
    await userEvent.click(await screen.findByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('logs in and redirects to the invoice list', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ accessToken: 't', tokenType: 'Bearer', expiresIn: 3600, user });
    renderLogin();

    await userEvent.type(await screen.findByLabelText(/email address/i), 'admin@simpleinvoice.dev');
    await userEvent.type(screen.getByLabelText(/password/i), 'Password123!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/invoices'));
    expect(authApi.login).toHaveBeenCalledWith('admin@simpleinvoice.dev', 'Password123!');
  });

  it('shows the server error for bad credentials', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, ['Invalid email or password']));
    renderLogin();

    await userEvent.type(await screen.findByLabelText(/email address/i), 'admin@simpleinvoice.dev');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });
});
