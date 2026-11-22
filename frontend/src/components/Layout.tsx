import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/invoices" className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>SimpleInvoice</span>
        </Link>
        <nav className="app-nav">
          <NavLink to="/invoices" end>
            Invoices
          </NavLink>
          <NavLink to="/invoices/new">New invoice</NavLink>
        </nav>
        <div className="app-user">
          <span className="app-user-name" title={user?.email}>
            {user?.fullname}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
