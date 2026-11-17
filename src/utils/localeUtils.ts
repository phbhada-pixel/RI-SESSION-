export const APP_PRIMARY_LOCALE = 'en-IN';
export const APP_SECONDARY_LOCALE = 'mr-IN';
export const APP_FALLBACK_LOCALE = 'en-US';
export const APP_TIMEZONE = 'Asia/Kolkata';
export const APP_CURRENCY = 'INR';

/**
 * Resolves the first supported BCP 47 locale from preferred candidates,
 * falling back safely to 'en-IN' or 'en-US' without ever throwing.
 */
export function resolveSafeIntlLocale(
  candidates: readonly string[] = [APP_PRIMARY_LOCALE, APP_SECONDARY_LOCALE, APP_FALLBACK_LOCALE]
): string {
  for (const loc of candidates) {
    try {
      const supported = Intl.DateTimeFormat.supportedLocalesOf([loc]);
      if (supported.length > 0) {
        return supported[0];
      }
    } catch {
      // Ignore invalid or unsupported locale identifiers and try next candidate
    }
  }
  return APP_FALLBACK_LOCALE;
}

/**
 * Formats an ISO date ('YYYY-MM-DD') or timestamp into DD-MM-YYYY in Asia/Kolkata (IST).
 */
export function formatDateIST(input?: string | Date | null): string {
  if (!input) return '-';
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-');
    return `${d}-${m}-${y}`;
  }
  const dateObj = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dateObj.getTime())) {
    return typeof input === 'string' ? input : '-';
  }

  try {
    const locale = resolveSafeIntlLocale();
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: APP_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(dateObj);
    const day = parts.find((p) => p.type === 'day')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const year = parts.find((p) => p.type === 'year')?.value;
    if (day && month && year) {
      return `${day}-${month}-${year}`;
    }
  } catch {
    // Fallback below
  }

  const istDate = new Date(dateObj.getTime() + 5.5 * 60 * 60 * 1000);
  const dd = String(istDate.getUTCDate()).padStart(2, '0');
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = istDate.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Formats an ISO timestamp into 12-hour AM/PM time in Asia/Kolkata (IST).
 */
export function formatTime12hIST(input?: string | Date | null, includeSeconds = true): string {
  if (!input) return '-';
  const dateObj = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dateObj.getTime())) {
    return typeof input === 'string' ? input : '-';
  }

  const opts: Intl.DateTimeFormatOptions = {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  };

  try {
    const locale = resolveSafeIntlLocale();
    return new Intl.DateTimeFormat(locale, opts).format(dateObj);
  } catch {
    try {
      return new Intl.DateTimeFormat(APP_FALLBACK_LOCALE, opts).format(dateObj);
    } catch {
      return dateObj.toISOString().slice(11, 19);
    }
  }
}

/**
 * Formats an ISO timestamp into 'DD-MM-YYYY, hh:mm AM/PM IST' in Asia/Kolkata.
 */
export function formatDateTimeIST(input?: string | Date | null): string {
  if (!input) return '-';
  const dateObj = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dateObj.getTime())) {
    return typeof input === 'string' ? input : '-';
  }
  return `${formatDateIST(dateObj)}, ${formatTime12hIST(dateObj, false)} IST`;
}

/**
 * Formats a number using the Indian numbering system (en-IN) with safe fallback to en-US.
 */
export function formatNumberIN(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  try {
    const locale = resolveSafeIntlLocale([APP_PRIMARY_LOCALE, APP_FALLBACK_LOCALE]);
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Formats currency in INR (₹) using the Indian numbering system with safe fallback.
 */
export function formatCurrencyINR(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  try {
    const locale = resolveSafeIntlLocale([APP_PRIMARY_LOCALE, APP_FALLBACK_LOCALE]);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: APP_CURRENCY,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `₹${value}`;
  }
}
