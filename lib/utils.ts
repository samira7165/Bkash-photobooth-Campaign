// Canonical stored/compared form is the bare 11-digit local number (no +88) —
// strip it here so "01712345678" and "+8801712345678" are always the same
// phone everywhere (DB writes, OTP lookup, session/authorization checks).
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '').replace(/^\+88/, '');
}

export const PHONE_VALIDATION_MESSAGE = 'Enter an 11-digit phone number, excluding the optional +88 prefix';

export function isValidPhone(phone: unknown): phone is string {
  return typeof phone === 'string' && /^(?:\+88)?\d{11}$/.test(normalizePhone(phone));
}

/**
 * Rows written before normalizePhone stripped the +88 prefix may still have
 * it embedded in the DB. Use this for `where: { phone: { in: ... } }` lookups
 * against Participant/Session so old and new data both match a bare-digit
 * search phone.
 */
export function phoneSearchVariants(normalizedPhone: string): string[] {
  return [normalizedPhone, `+88${normalizedPhone}`];
}

const MASKED_KEY_PLACEHOLDER = '••••••••';

export function maskApiKey(key: string): string {
  if (!key) return '';
  const last4 = key.slice(-4);
  return `${MASKED_KEY_PLACEHOLDER}${last4}`;
}

export function isMaskedApiKey(value: string): boolean {
  return value.startsWith(MASKED_KEY_PLACEHOLDER);
}
