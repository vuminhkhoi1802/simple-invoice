import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { ClockService } from '../common/clock/clock.service';
import { InvoiceStatus, PersistedInvoiceStatus } from './domain/invoice-status';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { Invoice } from './entities/invoice.entity';
import { InvoicesService } from './invoices.service';

const TODAY = '2026-06-15';
const USER_ID = 'ad1e0902-1928-4345-b513-60c86c94fc91';

function uniqueViolation(constraint: string) {
  return new QueryFailedError('INSERT ...', [], Object.assign(new Error('duplicate key'), { code: '23505', constraint }));
}

function dto(overrides: Partial<CreateInvoiceDto> = {}): CreateInvoiceDto {
  return {
    invoiceNumber: 'INV-1',
    invoiceDate: '2026-06-01',
    dueDate: '2026-06-30',
    currency: 'AUD',
    customer: { fullname: 'Paul', email: 'paul@101digital.io' },
    items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
    ...overrides,
  };
}

function stubQueryBuilder(rows: Invoice[] = [], total = 0) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['andWhere', 'orderBy', 'addOrderBy', 'skip', 'take']) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb.getManyAndCount = jest.fn().mockResolvedValue([rows, total]);
  return qb;
}

describe('InvoicesService', () => {
  let repo: jest.Mocked<Pick<Repository<Invoice>, 'create' | 'save' | 'findOne' | 'createQueryBuilder'>>;
  let service: InvoicesService;
  const clock = { today: () => TODAY } as ClockService;

  beforeEach(() => {
    repo = {
      create: jest.fn((x) => x as Invoice),
      save: jest.fn(async (x) => ({ ...(x as Invoice), id: 'new-id' })),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as never;
    service = new InvoicesService(repo as unknown as Repository<Invoice>, clock);
  });

  describe('create', () => {
    beforeEach(() => {
      repo.findOne.mockImplementation(async () => {
        const saved = repo.save.mock.calls[0][0] as Invoice;
        return { ...saved, id: 'new-id', createdAt: new Date() } as Invoice;
      });
    });

    it('computes totals server-side and applies spec defaults (tax 10%, discount 0, Draft)', async () => {
      const result = await service.create(dto(), USER_ID);
      const saved = repo.save.mock.calls[0][0] as Invoice;

      expect(saved.status).toBe(PersistedInvoiceStatus.Draft);
      expect(saved.taxRate).toBe(10);
      expect(saved.createdBy).toBe(USER_ID);
      expect(saved.currencySymbol).toBe('AU$');
      expect(saved.items[0]).toMatchObject({ quantity: 2, rate: 1000, amount: 2000, position: 0 });
      expect(result).toMatchObject({
        invoiceSubTotal: 2000,
        totalTax: 200,
        totalDiscount: 0,
        totalAmount: 2200,
        totalPaid: 0,
        balanceAmount: 2200,
        status: InvoiceStatus.Draft,
      });
    });

    it('maps the invoice-number unique index violation to 409 Conflict', async () => {
      repo.save.mockRejectedValue(uniqueViolation('uq_invoices_invoice_number'));
      await expect(service.create(dto(), USER_ID)).rejects.toThrow(
        new ConflictException('Invoice number "INV-1" already exists'),
      );
    });

    it('does not mask unrelated database errors as conflicts', async () => {
      const other = uniqueViolation('some_other_constraint');
      repo.save.mockRejectedValue(other);
      await expect(service.create(dto(), USER_ID)).rejects.toBe(other);
    });

    it('rejects a discount larger than subtotal + tax with 400', async () => {
      await expect(service.create(dto({ discount: 5000 }), USER_ID)).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws 404 with the spec message', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(new NotFoundException('Invoice not found'));
    });

    it('derives Overdue at read time', async () => {
      repo.findOne.mockResolvedValue({
        id: 'x',
        status: PersistedInvoiceStatus.Pending,
        dueDate: '2026-06-14',
        items: [],
      } as unknown as Invoice);
      expect((await service.findOne('x')).status).toBe(InvoiceStatus.Overdue);
    });
  });

  describe('list', () => {
    function query(overrides: Partial<ListInvoicesQueryDto> = {}): ListInvoicesQueryDto {
      return Object.assign(new ListInvoicesQueryDto(), overrides);
    }

    it('translates the derived Overdue filter into SQL against the same "today"', async () => {
      const qb = stubQueryBuilder();
      repo.createQueryBuilder.mockReturnValue(qb as never);
      await service.list(query({ status: InvoiceStatus.Overdue }));
      expect(qb.andWhere).toHaveBeenCalledWith('invoice.status <> :paid AND invoice.dueDate < :today', {
        paid: 'Paid',
        today: TODAY,
      });
    });

    it('excludes overdue rows from the Pending filter', async () => {
      const qb = stubQueryBuilder();
      repo.createQueryBuilder.mockReturnValue(qb as never);
      await service.list(query({ status: InvoiceStatus.Pending }));
      expect(qb.andWhere).toHaveBeenCalledWith('invoice.status = :status AND invoice.dueDate >= :today', {
        status: 'Pending',
        today: TODAY,
      });
    });

    it('escapes LIKE wildcards in the keyword', async () => {
      const qb = stubQueryBuilder();
      repo.createQueryBuilder.mockReturnValue(qb as never);
      await service.list(query({ keyword: '50%_off' }));
      const brackets = qb.andWhere.mock.calls[0][0];
      const where = { where: jest.fn().mockReturnThis(), orWhere: jest.fn().mockReturnThis() };
      brackets.whereFactory(where);
      expect(where.where).toHaveBeenCalledWith('invoice.invoiceNumber ILIKE :term', { term: '%50\\%\\_off%' });
    });

    it('paginates and reports paging metadata', async () => {
      const qb = stubQueryBuilder([], 23);
      repo.createQueryBuilder.mockReturnValue(qb as never);
      const res = await service.list(query({ page: 3, pageSize: 10, sortBy: 'totalAmount', ordering: 'ASC' }));
      expect(qb.orderBy).toHaveBeenCalledWith('invoice.totalAmount', 'ASC');
      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(res.paging).toEqual({ page: 3, pageSize: 10, total: 23, totalPages: 3 });
    });
  });
});
