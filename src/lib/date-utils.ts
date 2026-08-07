export function safeParseDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isValidDate(value: string | number | Date | null | undefined): boolean {
  return safeParseDate(value) !== null;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
  return isFiniteNumber(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

// Local-timezone YYYY-MM-DD key. Unlike toISOString().slice(0, 10) this does not
// roll the date back a day for positive UTC offsets before midnight.
export function localDateKey(value: Date | string | number): string {
  const date = safeParseDate(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayLocalDateKey(now: Date = new Date()): string {
  return localDateKey(now);
}

function safeFormat(value: string | number | Date | null | undefined, formatter: (date: Date) => string): string {
  const date = safeParseDate(value);
  return date ? formatter(date) : '';
}

export function safeFormatDate(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
  locale = 'en-IN',
): string {
  return safeFormat(value, (date) => {
    try {
      return date.toLocaleString(locale, options);
    } catch {
      return date.toLocaleString();
    }
  });
}

export function safeFormatDateOnly(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale = 'en-IN',
): string {
  return safeFormat(value, (date) => {
    try {
      return date.toLocaleDateString(locale, options);
    } catch {
      return date.toLocaleDateString();
    }
  });
}

export function safeFormatTimeOnly(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { timeStyle: 'short' },
  locale = 'en-IN',
): string {
  return safeFormat(value, (date) => {
    try {
      return date.toLocaleTimeString(locale, options);
    } catch {
      return date.toLocaleTimeString();
    }
  });
}
