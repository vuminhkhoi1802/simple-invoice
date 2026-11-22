import { deriveInvoiceStatus } from './domain/invoice-status';
import { InvoiceDetailDto, InvoiceSummaryDto } from './dto/invoice-response.dto';
import { Invoice } from './entities/invoice.entity';

export function toInvoiceSummary(invoice: Invoice, today: string): InvoiceSummaryDto {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerFullname,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    currencySymbol: invoice.currencySymbol,
    totalAmount: invoice.totalAmount,
    balanceAmount: invoice.balanceAmount,
    status: deriveInvoiceStatus(invoice.status, invoice.dueDate, today),
  };
}

export function toInvoiceDetail(invoice: Invoice, today: string): InvoiceDetailDto {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceReference: invoice.invoiceReference,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    currencySymbol: invoice.currencySymbol,
    description: invoice.description,
    status: deriveInvoiceStatus(invoice.status, invoice.dueDate, today),
    customer: {
      fullname: invoice.customerFullname,
      email: invoice.customerEmail,
      mobileNumber: invoice.customerMobileNumber,
      address: invoice.customerAddress,
    },
    items: [...(invoice.items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
      })),
    taxRate: invoice.taxRate,
    invoiceSubTotal: invoice.invoiceSubTotal,
    totalTax: invoice.totalTax,
    totalDiscount: invoice.totalDiscount,
    totalAmount: invoice.totalAmount,
    totalPaid: invoice.totalPaid,
    balanceAmount: invoice.balanceAmount,
    createdAt: invoice.createdAt,
    createdBy: invoice.createdBy,
  };
}
