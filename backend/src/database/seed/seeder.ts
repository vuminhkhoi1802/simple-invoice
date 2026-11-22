import * as bcrypt from 'bcryptjs';
import Decimal from 'decimal.js';
import { DataSource, EntityManager } from 'typeorm';
import { currencySymbol } from '../../invoices/domain/currencies';
import { calculateInvoiceTotals } from '../../invoices/domain/invoice-calculator';
import { InvoiceItem } from '../../invoices/entities/invoice-item.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { User } from '../../users/user.entity';
import { APPENDIX_A_INVOICE, DEFAULT_USER_ID, generateInvoices, SeedInvoice } from './seed-data';

export interface SeedUser {
  email: string;
  password: string;
  fullname: string;
}

export interface SeedResult {
  userId: string;
  inserted: number;
  skipped: number;
}

/**
 * Idempotent: the default user is upserted (so README credentials always work) and
 * invoices are inserted only if their number does not exist yet. Safe to run on every boot.
 */
export async function seedDatabase(
  ds: DataSource,
  user: SeedUser,
  today: string,
  generatedCount = 40,
): Promise<SeedResult> {
  return ds.transaction(async (manager) => {
    const userId = await upsertUser(manager, user);
    const seeds = [APPENDIX_A_INVOICE, ...generateInvoices(today, generatedCount)];

    const existing = new Set(
      (
        await manager
          .createQueryBuilder(Invoice, 'i')
          .select('lower(i.invoiceNumber)', 'n')
          .getRawMany<{ n: string }>()
      ).map((r) => r.n),
    );

    const toInsert = seeds.filter((s) => !existing.has(s.invoiceNumber.toLowerCase()));
    for (const seed of toInsert) {
      await manager.save(Invoice, buildInvoice(seed, userId));
    }
    return { userId, inserted: toInsert.length, skipped: seeds.length - toInsert.length };
  });
}

async function upsertUser(manager: EntityManager, seed: SeedUser): Promise<string> {
  const email = seed.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(seed.password, 10);
  const existing = await manager.findOne(User, { where: { email } });
  if (existing) {
    await manager.update(User, { id: existing.id }, { passwordHash, fullname: seed.fullname });
    return existing.id;
  }
  // Re-use the Appendix A id unless another user already owns it.
  const idTaken = await manager.exists(User, { where: { id: DEFAULT_USER_ID } });
  const created = await manager.save(
    User,
    manager.create(User, {
      ...(idTaken ? {} : { id: DEFAULT_USER_ID }),
      email,
      passwordHash,
      fullname: seed.fullname,
    }),
  );
  return created.id;
}

function buildInvoice(seed: SeedInvoice, userId: string): Invoice {
  const base = calculateInvoiceTotals({
    items: [seed.item],
    taxRate: seed.taxRate,
    discount: seed.discount,
  });
  const totalPaid = new Decimal(base.totalAmount)
    .times(seed.paidRatio)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
  const totals = calculateInvoiceTotals({
    items: [seed.item],
    taxRate: seed.taxRate,
    discount: seed.discount,
    totalPaid,
  });

  const invoice = Object.assign(new Invoice(), {
    ...(seed.id ? { id: seed.id } : {}),
    invoiceNumber: seed.invoiceNumber,
    invoiceReference: seed.invoiceReference ?? null,
    invoiceDate: seed.invoiceDate,
    dueDate: seed.dueDate,
    currency: seed.currency,
    currencySymbol: currencySymbol(seed.currency),
    description: seed.description ?? null,
    status: seed.status,
    customerFullname: seed.customer.fullname,
    customerEmail: seed.customer.email,
    customerMobileNumber: seed.customer.mobileNumber ?? null,
    customerAddress: seed.customer.address ?? null,
    taxRate: seed.taxRate,
    ...totals,
    createdBy: userId,
    ...(seed.createdAt ? { createdAt: seed.createdAt } : {}),
  });
  invoice.items = [
    Object.assign(new InvoiceItem(), {
      ...(seed.item.id ? { id: seed.item.id } : {}),
      name: seed.item.name,
      quantity: seed.item.quantity,
      rate: seed.item.rate,
      amount: totals.invoiceSubTotal,
      position: 0,
    }),
  ];
  return invoice;
}
