import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CurrencyCode, SUPPORTED_CURRENCIES } from '../domain/currencies';
import { IsIsoDate, IsOnOrAfter } from './validators';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Optional strings: trim, and treat blank as "not provided". */
const trimToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
};

export class CreateCustomerDto {
  @ApiProperty({ example: 'Paul' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'customer.fullname is required' })
  @MaxLength(255)
  fullname: string;

  @ApiProperty({ example: 'paul@101digital.io' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'customer.email must be a valid email address' })
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ example: '947717364111' })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'customer.mobileNumber must be a valid phone number' })
  mobileNumber?: string;

  @ApiPropertyOptional({ example: 'Singapore' })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}

export class CreateInvoiceItemDto {
  @ApiProperty({ example: 'Honda RC150' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'item name is required' })
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt({ message: 'quantity must be a positive integer' })
  @IsPositive({ message: 'quantity must be a positive integer' })
  @Max(1_000_000)
  quantity: number;

  @ApiProperty({ example: 1000, description: 'Unit price, max 2 decimal places' })
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false }, {
    message: 'rate must be a number with at most 2 decimal places',
  })
  @IsPositive({ message: 'rate must be a positive number' })
  @Max(1_000_000_000)
  rate: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'INV-2026-0100', description: 'User-provided, unique (case-insensitive)' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'invoiceNumber is required' })
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9\-_/#.]*$/, {
    message: 'invoiceNumber may contain only letters, digits and - _ / # .',
  })
  invoiceNumber: string;

  @ApiPropertyOptional({ example: '#5721662' })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceReference?: string;

  @ApiProperty({ example: '2026-06-03', format: 'date' })
  @IsIsoDate()
  invoiceDate: string;

  @ApiProperty({ example: '2026-07-03', format: 'date', description: 'Must be on or after invoiceDate' })
  @IsIsoDate()
  @IsOnOrAfter('invoiceDate')
  dueDate: string;

  @ApiProperty({ enum: SUPPORTED_CURRENCIES, example: 'AUD' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(SUPPORTED_CURRENCIES, {
    message: `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
  })
  currency: CurrencyCode;

  @ApiPropertyOptional({ example: 'Invoice is issued to Kanglee' })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ type: CreateCustomerDto })
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  @IsNotEmpty({ message: 'customer is required' })
  customer: CreateCustomerDto;

  @ApiProperty({
    type: [CreateInvoiceItemDto],
    minItems: 1,
    maxItems: 1,
    description: 'Exactly one line item for this version; the schema supports many.',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'items must contain exactly one item' })
  @ArrayMaxSize(1, { message: 'items must contain exactly one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Tax percentage, e.g. 10 for 10%' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'taxRate must be a number with at most 2 decimal places' })
  @Min(0, { message: 'taxRate must be a non-negative number' })
  @Max(100, { message: 'taxRate must not exceed 100' })
  taxRate?: number;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Absolute discount amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'discount must be a number with at most 2 decimal places' })
  @Min(0, { message: 'discount must be a non-negative number' })
  discount?: number;
}
