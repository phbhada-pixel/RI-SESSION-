import { UserRole } from '../types';

/**
 * Strips non-digits and validates an optional 12-digit Aadhaar number.
 * Returns empty string if blank; throws descriptive Marathi error if malformed.
 */
export function sanitizeOptionalAadhaar(input?: string | null): string {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length !== 12) {
    throw new Error('आधार क्रमांक प्रविष्ट केल्यास तो अचूक १२ अंकांचा असणे आवश्यक आहे.');
  }
  return digits;
}

/**
 * Formats Aadhaar safely as XXXX-XXXX-1234 for ordinary UI & reports.
 * Never exposes the full 12-digit Aadhaar number.
 */
export function maskAadhaar(aadhaar?: string | null): string {
  const digits = String(aadhaar ?? '').replace(/\D/g, '');
  if (!digits) return 'नोंदवलेला नाही';
  if (digits.length < 4) return 'XXXX-XXXX-XXXX';
  const last4 = digits.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

/**
 * Only ADMIN and MEDICAL_OFFICER are authorized to reveal full Aadhaar on protected profile screens.
 */
export function canViewFullAadhaar(role?: UserRole | null): boolean {
  return role === 'ADMIN' || role === 'MEDICAL_OFFICER';
}

/**
 * Masks sensitive Aadhaar values inside Audit Log objects so logs never expose raw Aadhaar.
 */
export function maskSensitiveFieldsForAudit(
  obj: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!obj) return null;
  const clone: Record<string, unknown> = { ...obj };
  if ('aadhaarNumber' in clone && typeof clone.aadhaarNumber === 'string' && clone.aadhaarNumber) {
    clone.aadhaarNumber = maskAadhaar(clone.aadhaarNumber);
  }
  return clone;
}
