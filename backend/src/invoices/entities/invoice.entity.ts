import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalTransformer } from '../../common/utils/decimal.transformer';
import { User } from '../../users/user.entity';
import { PersistedInvoiceStatus } from '../domain/invoice-status';
import { InvoiceItem } from './invoice-item.entity';

const money = {
  type: 'numeric' as const,
  precision: 14,
  scale: 2,
  transformer: decimalTransformer,
};

/**
 * Customer details are embedded (customer_* columns) rather than normalised into a
 * customers table: an invoice is a legal snapshot of who was billed at issue time,
 * and the spec has no customer management feature. See README "Design decisions".
 *
 * Indexes and CHECK constraints live in the migration, which is the schema source of truth
 * (synchronize is disabled). Invoice numbers are unique case-insensitively.
 */
@Entity({ name: 'invoices' })
export class Invoice {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50 })
  invoiceNumber: string;

  @Column({ name: 'invoice_reference', type: 'varchar', length: 100, nullable: true })
  invoiceReference: string | null;

  @Column({ name: 'invoice_date', type: 'date' })
  invoiceDate: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ name: 'currency_symbol', type: 'varchar', length: 8 })
  currencySymbol: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: PersistedInvoiceStatus, enumName: 'invoice_status' })
  status: PersistedInvoiceStatus;

  @Column({ name: 'customer_fullname', type: 'varchar', length: 255 })
  customerFullname: string;

  @Column({ name: 'customer_email', type: 'varchar', length: 255 })
  customerEmail: string;

  @Column({ name: 'customer_mobile_number', type: 'varchar', length: 50, nullable: true })
  customerMobileNumber: string | null;

  @Column({ name: 'customer_address', type: 'text', nullable: true })
  customerAddress: string | null;

  @Column({ name: 'tax_rate', type: 'numeric', precision: 5, scale: 2, transformer: decimalTransformer })
  taxRate: number;

  @Column({ name: 'invoice_sub_total', ...money })
  invoiceSubTotal: number;

  @Column({ name: 'total_tax', ...money })
  totalTax: number;

  @Column({ name: 'total_discount', ...money })
  totalDiscount: number;

  @Column({ name: 'total_amount', ...money })
  totalAmount: number;

  @Column({ name: 'total_paid', ...money })
  totalPaid: number;

  @Column({ name: 'balance_amount', ...money })
  balanceAmount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: ['insert'] })
  items: InvoiceItem[];
}
