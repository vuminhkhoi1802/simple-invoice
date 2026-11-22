import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../../common/utils/decimal.transformer';
import { Invoice } from './invoice.entity';

@Entity({ name: 'invoice_items' })
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: decimalTransformer })
  rate: number;

  /** quantity × rate, stored so line amounts survive future rate-rounding changes. */
  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: decimalTransformer })
  amount: number;

  /** Preserves line ordering once multiple items are supported. */
  @Column({ type: 'smallint', default: 0 })
  position: number;
}
