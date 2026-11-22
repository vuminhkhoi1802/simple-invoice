import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { invoicesApi } from '../api/invoices';
import { ErrorState } from '../components/ErrorState';
import { Spinner } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatMoney } from '../lib/format';

export function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const query = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.get(id),
    retry: (count, err) => !(err instanceof ApiError && [400, 404].includes(err.status)) && count < 2,
  });

  const back = (
    <Link to="/invoices" className="back-link">
      ← Back to invoices
    </Link>
  );

  if (query.isPending) {
    return (
      <section>
        {back}
        <div className="card center-block">
          <Spinner label="Loading invoice" />
        </div>
      </section>
    );
  }

  if (query.isError) {
    const err = query.error;
    const notFound = err instanceof ApiError && (err.status === 404 || err.status === 400);
    return (
      <section>
        {back}
        <ErrorState
          title={notFound ? 'Invoice not found' : 'Could not load invoice'}
          messages={notFound ? ['It may have been removed, or the link is incorrect.'] : err.message.split('\n')}
          onRetry={notFound ? undefined : () => query.refetch()}
        />
      </section>
    );
  }

  const inv = query.data;
  const money = (n: number) => formatMoney(n, inv.currencySymbol);
  const discount = `${inv.totalDiscount > 0 ? '−' : ''}${money(inv.totalDiscount)}`;

  return (
    <section>
      {back}
      <div className="page-header">
        <div>
          <h1>
            Invoice {inv.invoiceNumber} <StatusBadge status={inv.status} />
          </h1>
          {inv.description && <p className="muted">{inv.description}</p>}
        </div>
        <div className="balance-callout">
          <span className="muted">Balance due</span>
          <strong data-testid="balance">{money(inv.balanceAmount)}</strong>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <h2>Invoice information</h2>
          <dl className="kv">
            <dt>Invoice number</dt>
            <dd>{inv.invoiceNumber}</dd>
            <dt>Reference</dt>
            <dd>{inv.invoiceReference ?? '—'}</dd>
            <dt>Invoice date</dt>
            <dd>{formatDate(inv.invoiceDate)}</dd>
            <dt>Due date</dt>
            <dd>{formatDate(inv.dueDate)}</dd>
            <dt>Currency</dt>
            <dd>
              {inv.currency} ({inv.currencySymbol})
            </dd>
            <dt>Status</dt>
            <dd>
              <StatusBadge status={inv.status} />
            </dd>
          </dl>
        </div>

        <div className="card">
          <h2>Customer</h2>
          <dl className="kv">
            <dt>Name</dt>
            <dd>{inv.customer.fullname}</dd>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${inv.customer.email}`}>{inv.customer.email}</a>
            </dd>
            <dt>Mobile</dt>
            <dd>{inv.customer.mobileNumber ?? '—'}</dd>
            <dt>Address</dt>
            <dd>{inv.customer.address ?? '—'}</dd>
          </dl>
        </div>
      </div>

      <div className="card table-card">
        <h2 className="card-title-padded">Line items</h2>
        <table className="items-table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" className="num">
                Qty
              </th>
              <th scope="col" className="num">
                Rate
              </th>
              <th scope="col" className="num">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((item) => (
              <tr key={item.id}>
                <td data-label="Item">{item.name}</td>
                <td data-label="Qty" className="num">
                  {item.quantity}
                </td>
                <td data-label="Rate" className="num">
                  {money(item.rate)}
                </td>
                <td data-label="Amount" className="num">
                  {money(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="totals" aria-label="Totals">
          <dt>Subtotal</dt>
          <dd>{money(inv.invoiceSubTotal)}</dd>
          <dt>Tax ({inv.taxRate}%)</dt>
          <dd>{money(inv.totalTax)}</dd>
          <dt>Discount</dt>
          <dd>{discount}</dd>
          <dt className="totals-strong">Total</dt>
          <dd className="totals-strong">{money(inv.totalAmount)}</dd>
          <dt>Paid</dt>
          <dd>{money(inv.totalPaid)}</dd>
          <dt className="totals-strong">Outstanding balance</dt>
          <dd className="totals-strong">{money(inv.balanceAmount)}</dd>
        </dl>
      </div>
    </section>
  );
}
