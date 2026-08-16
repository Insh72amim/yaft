import { parseIndianDate, MONTH_MAP } from '../../../src/common/utils/date-utils';

describe('date-utils', () => {
  it('has all 12 calendar months mapped', () => {
    expect(MONTH_MAP.jan).toBe(0);
    expect(MONTH_MAP.december).toBe(11);
    expect(MONTH_MAP.aug).toBe(7);
  });

  it('parses Month DD, YYYY format correctly', () => {
    const d = parseIndianDate('Aug 09, 2026', '07:34:01');
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(7);
    expect(d.getUTCDate()).toBe(9);
    expect(d.getUTCHours()).toBe(7);
    expect(d.getUTCMinutes()).toBe(34);
    expect(d.getUTCSeconds()).toBe(1);
  });

  it('parses DD-MM-YYYY format correctly', () => {
    const d = parseIndianDate('15-08-2026');
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(7);
    expect(d.getUTCDate()).toBe(15);
  });

  it('parses DD Mon YYYY format correctly', () => {
    const d = parseIndianDate('14 Aug 2026');
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(7);
    expect(d.getUTCDate()).toBe(14);
  });
});
