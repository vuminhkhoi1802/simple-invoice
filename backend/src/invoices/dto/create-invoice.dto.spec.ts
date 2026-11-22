import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInvoiceDto } from './create-invoice.dto';

const valid = () => ({
  invoiceNumber: 'INV-001',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  customer: { fullname: 'Paul', email: 'paul@101digital.io' },
  items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
});

async function errorsFor(payload: object): Promise<string[]> {
  const dto = plainToInstance(CreateInvoiceDto, payload);
  const flatten = (errs: Awaited<ReturnType<typeof validate>>): string[] =>
    errs.flatMap((e) => [...Object.values(e.constraints ?? {}), ...flatten(e.children ?? [])]);
  return flatten(await validate(dto, { whitelist: true, forbidNonWhitelisted: true }));
}

describe('CreateInvoiceDto validation', () => {
  it('accepts a minimal valid payload', async () => {
    expect(await errorsFor(valid())).toEqual([]);
  });

  describe('due date rule', () => {
    it('rejects a due date before the invoice date with the spec message', async () => {
      expect(await errorsFor({ ...valid(), dueDate: '2026-06-02' })).toEqual([
        'dueDate must be on or after invoiceDate',
      ]);
    });

    it('accepts a due date equal to the invoice date', async () => {
      expect(await errorsFor({ ...valid(), dueDate: '2026-06-03' })).toEqual([]);
    });

    it('reports an impossible calendar date once, not as an ordering error', async () => {
      expect(await errorsFor({ ...valid(), dueDate: '2026-02-30' })).toEqual([
        'dueDate must be a valid date (YYYY-MM-DD)',
      ]);
    });
  });

  it.each([
    [{ customer: { fullname: '   ', email: 'paul@101digital.io' } }, 'customer.fullname is required'],
    [{ customer: { fullname: 'Paul', email: 'not-an-email' } }, 'customer.email must be a valid email address'],
    [{ invoiceNumber: '' }, 'invoiceNumber is required'],
    [{ currency: 'XYZ' }, 'currency must be one of'],
    [{ items: [{ name: 'x', quantity: 0, rate: 1 }] }, 'quantity must be a positive integer'],
    [{ items: [{ name: 'x', quantity: 1.5, rate: 1 }] }, 'quantity must be a positive integer'],
    [{ items: [{ name: 'x', quantity: 1, rate: -1 }] }, 'rate must be a positive number'],
    [{ items: [{ name: 'x', quantity: 1, rate: 1.234 }] }, 'rate must be a number with at most 2 decimal places'],
    [{ items: [] }, 'items must contain exactly one item'],
    [
      {
        items: [
          { name: 'a', quantity: 1, rate: 1 },
          { name: 'b', quantity: 1, rate: 1 },
        ],
      },
      'items must contain exactly one item',
    ],
    [{ taxRate: -1 }, 'taxRate must be a non-negative number'],
    [{ discount: -5 }, 'discount must be a non-negative number'],
  ])('rejects %j', async (override, message) => {
    const errors = await errorsFor({ ...valid(), ...override });
    expect(errors.some((e) => e.includes(message))).toBe(true);
  });

  it('rejects unknown properties such as a client-supplied totalAmount or status', async () => {
    const errors = await errorsFor({ ...valid(), totalAmount: 1, status: 'Paid' });
    expect(errors).toEqual(
      expect.arrayContaining(['property totalAmount should not exist', 'property status should not exist']),
    );
  });

  it('normalises input: trims strings, upper-cases currency, lower-cases email', async () => {
    const dto = plainToInstance(CreateInvoiceDto, {
      ...valid(),
      invoiceNumber: '  INV-9 ',
      currency: 'usd',
      customer: { fullname: ' Paul ', email: ' Paul@Example.COM ', address: '  ' },
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.invoiceNumber).toBe('INV-9');
    expect(dto.currency).toBe('USD');
    expect(dto.customer.fullname).toBe('Paul');
    expect(dto.customer.email).toBe('paul@example.com');
    expect(dto.customer.address).toBeUndefined();
  });
});
