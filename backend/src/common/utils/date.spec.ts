import { addDays, isIsoCalendarDate } from './date';

describe('date utils', () => {
  it.each(['2026-01-31', '2024-02-29', '2026-12-01'])('accepts %s', (v) => {
    expect(isIsoCalendarDate(v)).toBe(true);
  });

  it.each(['2026-02-30', '2025-02-29', '2026-13-01', '26-01-01', '2026-1-1', '', null, 20260101])(
    'rejects %p',
    (v) => {
      expect(isIsoCalendarDate(v)).toBe(false);
    },
  );

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
