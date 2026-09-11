export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '');
}

export const PHONE_VALIDATION_MESSAGE = 'Enter an 11-digit phone number, excluding the optional +88 prefix';

export function isValidPhone(phone: unknown): phone is string {
  return typeof phone === 'string' && /^(?:\+88)?\d{11}$/.test(normalizePhone(phone));
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
