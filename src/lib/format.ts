export const ALLOWED_DOMAIN = "sirocco.ae";

export function isAllowedEmail(email: string) {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

export function money(value: number, currency = "USD") {
  return `${currency} ${Number(value).toLocaleString("en-US", {
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
