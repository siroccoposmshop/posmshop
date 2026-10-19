export const ALLOWED_DOMAIN = "sirocco.ae";

export function isAllowedEmail(email: string) {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

/**
 * Item costs are stored in USD (that's what the budgeting workbook gives).
 * Everyone sees AED; admin reports can switch to USD.
 */
export const USD_TO_AED = 3.6725;

export type DisplayCurrency = "AED" | "USD";

/** Formats a USD amount for display, converted to AED unless USD is asked for. */
export function money(usd: number, currency: DisplayCurrency = "AED") {
  const value = currency === "AED" ? Number(usd) * USD_TO_AED : Number(usd);
  return `${currency} ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function imageUrl(path: string | null | undefined) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-images/${path}`;
}

export function formatDate(value: string | Date, withTime = false) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Dubai",
  });
}

/**
 * Quantities a KAM may pick for an item: multiples of order_multiple,
 * capped by the per-order limit and current stock.
 */
export function qtyOptions(item: { order_multiple: number; max_per_order: number | null; stock: number }) {
  const step = Math.max(1, item.order_multiple);
  const cap = Math.min(item.max_per_order ?? Number.POSITIVE_INFINITY, item.stock, step * 50);
  const options: number[] = [];
  for (let q = step; q <= cap; q += step) options.push(q);
  return options;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Customer-facing version of a parent account name: drops the legal entity
 * part ("LLC", "(Br of …)", " - Ennismore") and title-cases it, e.g.
 * "25 HOURS HOTEL DUBAI ONE CENTRAL LLC - Ennismore" → "25 Hours Hotel Dubai One Central".
 */
export function friendlyAccountName(name: string | null | undefined) {
  if (!name) return "";
  let s = name.split(" - ")[0];
  for (let i = 0; i < 3; i++) s = s.replace(/\([^()]*\)/g, " ");
  s = s
    .replace(/\b(L\.?\s?L\.?\s?C|FZ-?LLC|FZE|FZCO|P\.?J\.?S\.?C|LTD|LIMITED)\b\.?/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[\s,.&-]+$/, "")
    .trim();
  if (!s) return name;
  return s.toLowerCase().replace(/(^|[\s/(-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
}
