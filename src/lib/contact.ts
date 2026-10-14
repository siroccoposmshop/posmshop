/**
 * Contact validation shared by the order form (browser) and placeOrder (server).
 *
 * Mobiles default to the UAE (+971): "050 123 4567", "50 123 4567" and
 * "+971 50 123 4567" are all accepted and stored as "+971 50 123 4567".
 * A number starting with another "+" country code is accepted as international.
 */
export const UAE_PREFIX = "+971";

export function normaliseMobile(input: string): { ok: true; value: string } | { ok: false; error: string } {
  const raw = input.trim();
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return { ok: false, error: "Enter the contact's mobile number." };

  const international = raw.startsWith("+") || raw.startsWith("00") || /^971\d{9}$/.test(digits);
  const intl = raw.startsWith("00") ? digits.slice(2) : digits;

  if (!international || intl.startsWith("971")) {
    // UAE: national number is 9 digits starting with 5 (50, 52, 54, 55, 56, 58)
    let national = international ? intl.slice(3) : digits;
    if (national.startsWith("0")) national = national.slice(1);
    if (!/^5[024568]\d{7}$/.test(national)) {
      return { ok: false, error: "Enter a valid UAE mobile, e.g. 050 123 4567." };
    }
    return { ok: true, value: `${UAE_PREFIX} ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}` };
  }

  if (!/^[1-9]\d{7,14}$/.test(intl)) {
    return { ok: false, error: "Enter a valid international mobile number, e.g. +44 7700 900123." };
  }
  return { ok: true, value: `+${intl}` };
}

const EMAIL_RE = /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

export function normaliseEmail(input: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = input.trim().toLowerCase();
  if (!value) return { ok: false, error: "Enter the contact's email." };
  if (value.length > 200 || !EMAIL_RE.test(value) || value.includes("..")) {
    return { ok: false, error: "Enter a valid email address, e.g. name@hotel.com." };
  }
  return { ok: true, value };
}
