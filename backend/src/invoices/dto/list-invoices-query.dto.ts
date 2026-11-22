import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { InvoiceStatus } from '../domain/invoice-status';
import { IsIsoDate, IsOnOrAfter } from './validators';

export const SORTABLE_FIELDS = ['invoiceDate', 'dueDate', 'totalAmount'] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];
export const MAX_PAGE_SIZE = 100;

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.toUpperCase() : value);
/** Accept status case-insensitively ("paid" -> "Paid"); blank means "all". */
const normaliseStatus = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? undefined : v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
};
const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class ListInvoicesQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize = 10;

  @ApiPropertyOptional({ enum: SORTABLE_FIELDS, default: 'invoiceDate' })
  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy: SortableField = 'invoiceDate';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @Transform(upper)
  @IsIn(['ASC', 'DESC'])
  ordering: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @Transform(normaliseStatus)
  @IsIn(Object.values(InvoiceStatus))
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Partial, case-insensitive match on invoice number or customer name' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Invoices dated on/after (YYYY-MM-DD)' })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsIsoDate()
  fromDate?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Invoices dated on/before (YYYY-MM-DD)' })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsIsoDate()
  @IsOnOrAfter('fromDate', { message: 'toDate must be on or after fromDate' })
  toDate?: string;
}
