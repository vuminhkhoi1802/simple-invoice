import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Single source of "today" for business rules (Overdue derivation, list filters).
 * Injected rather than calling `new Date()` inline so tests can pin the date and
 * so the read path and the SQL filter path always agree on the same calendar day.
 */
@Injectable()
export class ClockService {
  private readonly formatter: Intl.DateTimeFormat;

  constructor(config: ConfigService) {
    this.formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.get<string>('APP_TIMEZONE', 'UTC'),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  /** Current calendar date in the configured timezone, formatted YYYY-MM-DD. */
  today(): string {
    return this.formatter.format(new Date());
  }
}
