import { normalizePhone } from './utils';

// Browser-local memory of the last phone number verified here, used only to
// prefill the download form. It carries no authority: the server decides
// whether to skip the OTP, based on its own signed `dl_remember` cookie.
// Storage can be unavailable or throw outright (private windows, blocked site
// data), and remembering is a convenience, so every access is best-effort.

const STORAGE_KEY = 'photobooth:rememberedPhone';

export function rememberPhone(phone: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, normalizePhone(phone));
  } catch {
    /* not remembered — the user simply types their number again */
  }
}

export function getRememberedPhone(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function forgetPhone(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clean up */
  }
}
