/**
 * Shared date normalization, month mapping, and parser helpers.
 */

export const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export function parseIndianDate(dateStr: string, timeStr?: string): Date {
  if (!dateStr) return new Date();

  let hours = 0, minutes = 0, seconds = 0;
  if (timeStr) {
    const tMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(am|pm))?/i);
    if (tMatch) {
      hours = parseInt(tMatch[1], 10);
      minutes = parseInt(tMatch[2], 10);
      if (tMatch[3]) seconds = parseInt(tMatch[3], 10);
      if (tMatch[4]?.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (tMatch[4]?.toLowerCase() === 'am' && hours === 12) hours = 0;
    }
  }

  const cleanDate = dateStr.trim();

  // 1. Match Month DD, YYYY e.g. "Aug 09, 2026", "August 9 2026"
  const monthFirstMatch = cleanDate.match(/^([a-zA-Z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (monthFirstMatch) {
    const month = MONTH_MAP[monthFirstMatch[1].toLowerCase()] ?? 0;
    const day = parseInt(monthFirstMatch[2], 10);
    let year = parseInt(monthFirstMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  }

  // 2. Match DD-Mon-YYYY or DD Mon YYYY e.g. "09-Aug-2026", "09 Aug 2026"
  const alphaMatch = cleanDate.match(/^(\d{1,2})[-\s]?([a-zA-Z]{3,9})[-\s,]?(\d{2,4})$/);
  if (alphaMatch) {
    const day = parseInt(alphaMatch[1], 10);
    const month = MONTH_MAP[alphaMatch[2].toLowerCase()] ?? 0;
    let year = parseInt(alphaMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  }

  // 3. Match DD-MM-YY or DD/MM/YYYY
  const numMatch = cleanDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (numMatch) {
    const day = parseInt(numMatch[1], 10);
    const month = parseInt(numMatch[2], 10) - 1;
    let year = parseInt(numMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  }

  // 4. Match YYYY-MM-DD
  const isoMatch = cleanDate.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  }

  const parsed = new Date(cleanDate);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}
