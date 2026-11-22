import { addDaysIso, formatDate, formatMoney, todayIso } from './format';

describe('format helpers', () => {
  it('formats dates without shifting the day', () => {
    expect(formatDate('2026-06-03')).toBe('03 Jun 2026');
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026');
  });

  it('formats money with symbol, grouping and 2 decimals', () => {
    expect(formatMoney(2180, 'AU$')).toBe('AU$2,180.00');
    expect(formatMoney(728.66, '£')).toBe('£728.66');
    expect(formatMoney(-5, '$')).toBe('-$5.00');
  });

  it('computes ISO dates', () => {
    expect(todayIso(new Date(2026, 5, 3, 12))).toBe('2026-06-03');
    expect(addDaysIso('2026-01-31', 30)).toBe('2026-03-02');
  });
});
