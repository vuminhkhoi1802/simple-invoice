import { screen } from '@testing-library/react';
import { authApi } from '../api/auth';
import { ApiError } from '../api/client';
import { renderWithProviders } from '../test/utils';
import { NotFoundPage } from './NotFoundPage';

vi.mock('../api/auth', () => ({
  authApi: { login: vi.fn(), me: vi.fn(), logout: vi.fn() },
}));

function renderNotFound() {
  return renderWithProviders(<NotFoundPage />, { route: '/does-not-exist', path: '*' });
}

describe('NotFoundPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiError(401, ['Authentication required']));
  });

  it('renders its content inside a main landmark', async () => {
    renderNotFound();

    const main = await screen.findByRole('main');
    expect(main).toContainElement(screen.getByRole('heading', { name: /page not found/i }));
    expect(main).toContainElement(screen.getByRole('link', { name: /go to invoices/i }));
  });

  it('links back to the invoice list', async () => {
    renderNotFound();

    expect(await screen.findByRole('link', { name: /go to invoices/i })).toHaveAttribute('href', '/invoices');
  });
});
