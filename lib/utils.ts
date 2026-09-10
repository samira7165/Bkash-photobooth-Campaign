export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '');
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
