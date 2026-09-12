import axios from 'axios';
import { normalizePhone } from './utils';

/**
 * Route Mobile (RML Connect) SMS gateway client — the project's real SMS
 * provider. Server-only: it sends the account password as a query parameter,
 * which must never reach the browser.
 *
 * Contract (HTTP GET, plain-text response):
 *   GET {ROUTE_MOBILE_API_URL}?username=&password=&source=&destination=&message=
 *   -> "1701|8801712345678|<message-id>"   success
 *   -> "1703|..."                          failure (see GATEWAY_ERRORS)
 *
 * Replaced the previous XRI gateway, which authenticated by IP/Origin
 * whitelist; Route Mobile authenticates with credentials instead, so the
 * deploy host no longer has to be whitelisted.
 */

const SUCCESS_CODE = '1701';

/** Documented RML Connect response codes, for actionable error messages. */
const GATEWAY_ERRORS: Record<string, string> = {
  '1702': 'invalid URL — a required parameter is missing or malformed',
  '1703': 'invalid username or password',
  '1704': 'invalid message type',
  '1705': 'invalid message content',
  '1706': 'invalid destination number',
  '1707': 'invalid source (sender) address',
  '1708': 'invalid delivery-report setting',
  '1709': 'user validation failed',
  '1710': 'internal gateway error',
  '1025': 'insufficient credit on the account',
};

/**
 * Route Mobile addresses handsets by full MSISDN (88 + the 11-digit local
 * number). normalizePhone() gives us the canonical bare local form, but rows
 * written before it existed can still carry a country code, so strip a
 * leading 88 before re-adding it rather than ending up with "8888017...".
 */
function toMsisdn(phone: string): string {
  const digits = normalizePhone(phone).replace(/\D/g, '');
  const local = digits.startsWith('88') ? digits.slice(2) : digits;
  return `88${local}`;
}

export async function sendRouteMobileSms(phone: string, message: string): Promise<void> {
  const url = process.env.ROUTE_MOBILE_API_URL;
  const username = process.env.ROUTE_MOBILE_USERNAME;
  const password = process.env.ROUTE_MOBILE_PASSWORD;
  const source = process.env.ROUTE_MOBILE_SOURCE;

  if (!url || !username || !password || !source) {
    throw new Error(
      'Route Mobile SMS gateway is not configured — set ROUTE_MOBILE_API_URL, '
      + 'ROUTE_MOBILE_USERNAME, ROUTE_MOBILE_PASSWORD and ROUTE_MOBILE_SOURCE',
    );
  }

  const res = await axios.get(url, {
    params: { username, password, source, destination: toMsisdn(phone), message },
    timeout: 15_000,
    responseType: 'text',
    validateStatus: () => true, // read the gateway's own error text instead of an axios throw
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Route Mobile gateway returned HTTP ${res.status}`);
  }

  // Success and failure both come back 200 with a pipe-delimited body, so the
  // leading code is the only thing that actually says whether it was accepted.
  const body = String(res.data ?? '').trim();
  const code = body.split('|')[0]?.trim() ?? '';

  if (code !== SUCCESS_CODE) {
    const reason = GATEWAY_ERRORS[code] ?? 'unrecognised gateway response';
    throw new Error(`Route Mobile rejected the message (${code || 'no code'}: ${reason}) — response: ${body.slice(0, 200)}`);
  }
}
