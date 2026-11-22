import { Body, Controller, Get, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceDetailDto, InvoiceListResponseDto } from './dto/invoice-response.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiBearerAuth()
@ApiCookieAuth(ACCESS_TOKEN_COOKIE)
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Missing, invalid or expired token' })
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices with search, filter, sort and server-side pagination' })
  @ApiOkResponse({ type: InvoiceListResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  list(@Query() query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    return this.invoices.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice detail by ID' })
  @ApiOkResponse({ type: InvoiceDetailDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'id is not a UUID' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Invoice not found' })
  findOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) id: string,
  ): Promise<InvoiceDetailDto> {
    return this.invoices.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create an invoice',
    description: 'Totals are calculated server-side. New invoices are always created with status Draft.',
  })
  @ApiCreatedResponse({ type: InvoiceDetailDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Validation failed' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Invoice number already exists' })
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser): Promise<InvoiceDetailDto> {
    return this.invoices.create(dto, user.id);
  }
}
