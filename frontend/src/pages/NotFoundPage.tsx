import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="full-page-center">
      <div className="card empty-state">
        <h1>Page not found</h1>
        <Link to="/invoices" className="btn btn-primary">
          Go to invoices
        </Link>
      </div>
    </main>
  );
}
