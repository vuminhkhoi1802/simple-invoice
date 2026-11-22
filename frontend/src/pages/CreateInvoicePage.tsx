import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useForm, type FieldError } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toApiError } from '../api/client';
import { invoicesApi } from '../api/invoices';
import { CURRENCIES } from '../api/types';
import { useToast } from '../components/Toast';
import { addDaysIso, todayIso } from '../lib/format';
import {
  createInvoiceSchema,
  toCreatePayload,
  type CreateInvoiceFormInput,
  type CreateInvoiceFormValues,
} from './createInvoiceSchema';

function Field({
  id,
  label,
  error,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: FieldError;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="required" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error.message}
        </p>
      )}
    </div>
  );
}

export function CreateInvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const today = todayIso();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateInvoiceFormInput, unknown, CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceSchema),
    mode: 'onTouched',
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerMobile: '',
      customerAddress: '',
      invoiceNumber: '',
      invoiceReference: '',
      invoiceDate: today,
      dueDate: addDaysIso(today, 30),
      currency: 'AUD',
      description: '',
      itemName: '',
      itemQuantity: 1,
      itemRate: undefined,
      taxRate: 10,
      discount: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: invoicesApi.create,
    onSuccess: async (invoice) => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      notify(`Invoice ${invoice.invoiceNumber} created`, 'success');
      navigate('/invoices');
    },
    onError: (e) => {
      const err = toApiError(e);
      if (err.status === 409) {
        setError('invoiceNumber', { type: 'server', message: 'This invoice number is already in use' });
        setServerErrors([]);
        return;
      }
      setServerErrors(err.messages);
    },
  });

  const onSubmit = (values: CreateInvoiceFormValues) => {
    setServerErrors([]);
    mutation.mutate(toCreatePayload(values));
  };

  const a11y = (name: keyof CreateInvoiceFormInput) => ({
    id: name,
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  return (
    <section>
      <Link to="/invoices" className="back-link">
        ← Back to invoices
      </Link>
      <div className="page-header">
        <h1>New invoice</h1>
      </div>

      <form className="invoice-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverErrors.length > 0 && (
          <div className="alert alert-error" role="alert">
            <strong>Could not create invoice</strong>
            <ul>
              {serverErrors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <fieldset className="card">
          <legend>Customer</legend>
          <div className="form-grid">
            <Field id="customerName" label="Customer name" required error={errors.customerName}>
              <input {...a11y('customerName')} autoComplete="off" {...register('customerName')} />
            </Field>
            <Field id="customerEmail" label="Customer email" required error={errors.customerEmail}>
              <input type="email" {...a11y('customerEmail')} {...register('customerEmail')} />
            </Field>
            <Field id="customerMobile" label="Mobile" error={errors.customerMobile}>
              <input type="tel" {...a11y('customerMobile')} {...register('customerMobile')} />
            </Field>
            <Field id="customerAddress" label="Address" error={errors.customerAddress}>
              <input {...a11y('customerAddress')} {...register('customerAddress')} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>Invoice details</legend>
          <div className="form-grid">
            <Field id="invoiceNumber" label="Invoice number" required error={errors.invoiceNumber}>
              <input {...a11y('invoiceNumber')} placeholder="e.g. INV-2026-0042" {...register('invoiceNumber')} />
            </Field>
            <Field id="invoiceReference" label="Reference" error={errors.invoiceReference}>
              <input {...a11y('invoiceReference')} placeholder="e.g. PO number" {...register('invoiceReference')} />
            </Field>
            <Field id="invoiceDate" label="Invoice date" required error={errors.invoiceDate}>
              <input type="date" {...a11y('invoiceDate')} {...register('invoiceDate', { deps: ['dueDate'] })} />
            </Field>
            <Field id="dueDate" label="Due date" required error={errors.dueDate}>
              <input type="date" {...a11y('dueDate')} {...register('dueDate')} />
            </Field>
            <Field id="currency" label="Currency" required error={errors.currency}>
              <select {...a11y('currency')} {...register('currency')}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="description" label="Description" error={errors.description}>
              <input {...a11y('description')} {...register('description')} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>Line item</legend>
          <div className="form-grid form-grid-item">
            <Field id="itemName" label="Item name" required error={errors.itemName}>
              <input {...a11y('itemName')} {...register('itemName')} />
            </Field>
            <Field id="itemQuantity" label="Quantity" required error={errors.itemQuantity}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                {...a11y('itemQuantity')}
                {...register('itemQuantity', { valueAsNumber: true })}
              />
            </Field>
            <Field id="itemRate" label="Rate" required error={errors.itemRate}>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                {...a11y('itemRate')}
                {...register('itemRate', { valueAsNumber: true })}
              />
            </Field>
            <Field id="taxRate" label="Tax (%)" error={errors.taxRate} hint="Defaults to 10%">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                {...a11y('taxRate')}
                {...register('taxRate', { valueAsNumber: true })}
              />
            </Field>
            <Field id="discount" label="Discount" error={errors.discount} hint="Fixed amount">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                {...a11y('discount')}
                {...register('discount', { valueAsNumber: true })}
              />
            </Field>
          </div>
          <p className="muted small">Totals are calculated by the server when the invoice is saved.</p>
        </fieldset>

        <div className="form-actions">
          <Link to="/invoices" className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Create invoice'}
          </button>
        </div>
      </form>
    </section>
  );
}
