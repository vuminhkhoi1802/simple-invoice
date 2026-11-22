import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { Brackets, QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import { ClockService } from '../common/clock/clock.service';
import { currencySymbol } from './domain/currencies';
import { calculateInvoiceTotals, InvoiceCalculationError } from './domain/invoice-calculator';
import { InvoiceStatus, PersistedInvoiceStatus } from './domain/invoice-status';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceDetailDto, InvoiceListResponseDto } from './dto/invoice-response.dto';
import { ListInvoicesQueryDto, SortableField } from './dto/list-invoices-query.dto';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Invoice } from './entities/invoice.entity';
import { toInvoiceDetail, toInvoiceSummary } from './invoice.mapper';

export const DEFAULT_TAX_RATE = 10;
const UNIQUE_VIOLATION = '23505';
const INVOICE_NUMBER_UNIQUE_INDEX = 'uq_invoices_invoice_number';

/** Whitelisted sort columns: user input never reaches SQL as an identifier. */
const SORT_COLUMNS: Record<SortableField, string> = {
  invoiceDate: 'invoice.invoiceDate',
  dueDate: 'invoice.dueDate',
  totalAmount: 'invoice.totalAmount',
};

/** Escape LIKE wildcards so a search for "50%" matches literally. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    private readonly clock: ClockService,
  ) {}

  async list(query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    const today = this.clock.today();
    const qb = this.invoices.createQueryBuilder('invoice');

    this.applyStatusFilter(qb, query.status, today);

    if (query.keyword) {
      const term = `%${escapeLike(query.keyword)}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('invoice.invoiceNumber ILIKE :term', { term })
            .orWhere('invoice.customerFullname ILIKE :term', { term }),
        ),
      );
    }
    if (query.fromDate) qb.andWhere('invoice.invoiceDate >= :fromDate', { fromDate: query.fromDate });
    if (query.toDate) qb.andWhere('invoice.invoiceDate <= :toDate', { toDate: query.toDate });

    // Secondary keys make ordering deterministic so rows never repeat/skip across pages.
    qb.orderBy(SORT_COLUMNS[query.sortBy], query.ordering)
      .addOrderBy('invoice.createdAt', 'DESC')
      .addOrderBy('invoice.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map((row) => toInvoiceSummary(row, today)),
      paging: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findOne(id: string): Promise<InvoiceDetailDto> {
    const invoice = await this.invoices.findOne({ where: { id }, relations: { items: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return toInvoiceDetail(invoice, this.clock.today());
  }

  async create(dto: CreateInvoiceDto, userId: string): Promise<InvoiceDetailDto> {
    const taxRate = dto.taxRate ?? DEFAULT_TAX_RATE;
    const discount = dto.discount ?? 0;

    let totals;
    try {
      totals = calculateInvoiceTotals({ items: dto.items, taxRate, discount, totalPaid: 0 });
    } catch (err) {
      if (err instanceof InvoiceCalculationError) throw new BadRequestException([err.message]);
      throw err;
    }

    const invoice = this.invoices.create({
      invoiceNumber: dto.invoiceNumber,
      invoiceReference: dto.invoiceReference ?? null,
      invoiceDate: dto.invoiceDate,
      dueDate: dto.dueDate,
      currency: dto.currency,
      currencySymbol: currencySymbol(dto.currency),
      description: dto.description ?? null,
      status: PersistedInvoiceStatus.Draft, // spec: new invoices are always Draft
      customerFullname: dto.customer.fullname,
      customerEmail: dto.customer.email,
      customerMobileNumber: dto.customer.mobileNumber ?? null,
      customerAddress: dto.customer.address ?? null,
      taxRate,
      ...totals,
      createdBy: userId,
      items: dto.items.map((item, position) =>
        Object.assign(new InvoiceItem(), {
          name: item.name,
          quantity: item.quantity,
          rate: item.rate,
          amount: new Decimal(item.quantity).times(item.rate).toDecimalPlaces(2).toNumber(),
          position,
        }),
      ),
    });

    try {
      // save() wraps the invoice + cascaded items in a single transaction.
      const saved = await this.invoices.save(invoice);
      return this.findOne(saved.id);
    } catch (err) {
      // Uniqueness is enforced by the database index, not a racy pre-check.
      if (isUniqueViolation(err, INVOICE_NUMBER_UNIQUE_INDEX)) {
        throw new ConflictException(`Invoice number "${dto.invoiceNumber}" already exists`);
      }
      throw err;
    }
  }

  /**
   * Overdue is not stored, so each status filter is translated into the same
   * predicate deriveInvoiceStatus() applies in memory, evaluated against the
   * same `today`, so list filtering and displayed status can never disagree.
   */
  private applyStatusFilter(qb: SelectQueryBuilder<Invoice>, status: InvoiceStatus | undefined, today: string) {
    switch (status) {
      case undefined:
        return;
      case InvoiceStatus.Overdue:
        qb.andWhere('invoice.status <> :paid AND invoice.dueDate < :today', {
          paid: PersistedInvoiceStatus.Paid,
          today,
        });
        return;
      case InvoiceStatus.Paid:
        qb.andWhere('invoice.status = :status', { status: PersistedInvoiceStatus.Paid });
        return;
      default:
        qb.andWhere('invoice.status = :status AND invoice.dueDate >= :today', { status, today });
    }
  }
}

export function isUniqueViolation(err: unknown, constraint: string): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const driverError = (err as QueryFailedError & { driverError?: { code?: string; constraint?: string } })
    .driverError;
  return driverError?.code === UNIQUE_VIOLATION && driverError.constraint === constraint;
}
