import { screen } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { authApi } from '../api/auth';
import { ApiError } from '../api/client';
import { renderWithProviders } from '../test/utils';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('../api/auth', () => ({
  authApi: { login: vi.fn(), me: vi.fn(), logout: vi.fn() },
}));

function renderAt(route: string) {
  return renderWithProviders(<ProtectedRoute />, {
    route,
    path: '/',
    extraRoutes: (
      <>
        <Route element={<ProtectedRoute />}>
          <Route path="/invoices" element={<p>Secret invoices</p>} />
        </Route>
        <Route path="/login" element={<p>Login screen</p>} />
      </>
    ),
  });
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiError(401, ['Authentication required']));
    renderAt('/invoices');
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
    expect(screen.queryByText('Secret invoices')).not.toBeInTheDocument();
  });

  it('renders the protected page when the session is valid', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ id: 'u1', email: 'a@b.co', fullname: 'A', createdAt: '' });
    renderAt('/invoices');
    expect(await screen.findByText('Secret invoices')).toBeInTheDocument();
  });
});
