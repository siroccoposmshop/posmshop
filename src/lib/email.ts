import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, money } from "@/lib/format";
import { DEFAULT_ORDER_DESK } from "@/lib/markets";
import type { Market, Order, OrderItem } from "@/lib/types";

/** "kam": the order confirmation, sent to the KAM and the order desk (MMI) together. "customer": the outlet contact. */
export type Audience = "kam" | "customer";

const GREEN = "#58a244";
const GREY = "#545658";
const LIGHT = "#ebe9e9";
const RED = "#cb3727";
const FONT = "'Roboto Condensed','Arial Narrow',Arial,sans-serif";
const BODY_FONT = "Vazirmatn,'Segoe UI',Arial,sans-serif";

function esc(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

function outletLabel(order: Order) {
  return order.parent_name && order.parent_name !== order.account_name
    ? `${order.account_name} (${order.parent_name})`
    : order.account_name;
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

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function emailSubject(order: Order, audience: Audience) {
  if (audience === "customer") return `Your POSM order for ${order.account_name} · ${order.order_number}`;
  return `[${order.market}] POSM order ${order.order_number} · ${outletLabel(order)}`;
}

const LABEL = `font-family:${FONT};font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:${GREY}`;
const VALUE = `font-family:${BODY_FONT};font-size:14px;line-height:1.4;color:#000`;
const ROW = "border-bottom:1px solid #eeeded";

/** A label stacked above its value. */
function field(label: string, value: string) {
  return `<div style="${LABEL}">${label}</div><div style="${VALUE};margin-top:1px">${value}</div>`;
}

/** One or two fields side by side; a lone field spans the row. */
function fieldRow(left: string, right?: string) {
  const cell = (html: string, w: string) => `<td width="${w}" style="padding:0 8px 10px 0;vertical-align:top">${html}</td>`;
  return `<tr>${right === undefined ? `<td colspan="2" style="padding:0 0 10px;vertical-align:top">${left}</td>` : cell(left, "50%") + cell(right, "50%")}</tr>`;
}

export function renderOrderEmail(order: Order, items: OrderItem[], market: Market, audience: Audience) {
  const isCustomer = audience === "customer";
  const venue = friendlyAccountName(order.parent_name);
  const outletAtVenue = `<strong>${esc(order.account_name)}</strong>${
    venue && venue.toLowerCase() !== order.account_name.toLowerCase() ? ` at ${esc(venue)}` : ""
  }`;
  const kam = order.kam_name || order.kam_email;

  const intro = isCustomer
    ? `Dear ${esc(firstName(order.contact_name))},<br>Here is the POSM ordered for ${outletAtVenue}. Delivery is expected within <strong>${market.delivery_days} days</strong>.`
    : `${esc(kam)} placed this order for ${outletAtVenue}.<br>Customer Service: please execute. KAM: keep this as your proof of execution.`;

  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:8px 8px 8px 0;${ROW};${VALUE}">${esc(i.name)}<div style="font-size:12px;color:${GREY}">${esc(i.brand)} · ${esc(i.sku)}</div></td>
        <td align="right" style="padding:8px 0;${ROW};${VALUE};white-space:nowrap;vertical-align:top"><strong>× ${i.qty}</strong>${
          isCustomer ? "" : `<div style="font-size:12px;color:${GREY}">${esc(money(i.line_value))}</div>`
        }</td>
      </tr>`,
    )
    .join("");

  const total = isCustomer
    ? ""
    : `<tr><td align="right" style="padding:12px 8px 0 0;${LABEL}">Total</td>
        <td align="right" style="padding:12px 0 0;font-family:${FONT};font-size:18px;font-weight:700;color:#000;white-space:nowrap">${esc(money(order.total_value))}</td></tr>`;

  const contact = `${esc(order.contact_name)}<br>${esc(order.contact_mobile)}<br>${esc(order.contact_email)}`;
  const orderNo = field("Order", `<strong>${esc(order.order_number)}</strong>`);
  const date = field("Date", esc(formatDate(order.created_at, true)));

  const details = isCustomer
    ? [
        fieldRow(orderNo, date),
        fieldRow(field("Delivering to", `<strong>${esc(order.account_name)}</strong>${venue ? `<br>${esc(venue)}` : ""}`), field("Contact", contact)),
      ].join("")
    : [
        fieldRow(orderNo, date),
        fieldRow(field("Outlet", `<strong>${esc(order.account_name)}</strong><br>#${esc(order.account_number)}`), field("Market", esc(market.name))),
        fieldRow(field("Account", `${esc(order.parent_name ?? order.account_name)} · #${esc(order.parent_number ?? order.account_number)}`)),
        fieldRow(field("Contact", contact), field("KAM", `${esc(kam)}<br>${esc(order.kam_email)}`)),
        order.notes ? fieldRow(field("Notes", esc(order.notes))) : "",
      ].join("");

  const signOff = isCustomer
    ? `<p style="margin:20px 0 0;${VALUE};color:${GREY}">Questions? Just reply to this email.<br><br>Kind regards,<br><strong style="color:#000">${esc(kam)}</strong>, Sirocco</p>`
    : "";

  const link =
    !isCustomer && siteUrl()
      ? `<p style="margin:18px 0 0"><a href="${siteUrl()}/orders/${order.id}" style="display:inline-block;background:${GREEN};color:#fff;text-decoration:none;font-family:${FONT};text-transform:uppercase;letter-spacing:.04em;font-size:13px;padding:9px 18px;border-radius:999px">View order</a></p>`
      : "";

  const logo = siteUrl()
    ? `<img src="${siteUrl()}/email-logo-white.png" width="96" alt="SIROCCO" style="display:block;width:96px;height:auto">`
    : `<span style="font-family:${FONT};font-size:17px;font-weight:700;color:#fff;letter-spacing:.08em">SIROCCO</span>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(emailSubject(order, audience))}</title></head>
<body style="margin:0;padding:0;background:${LIGHT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT}"><tr><td align="center" style="padding:16px 8px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:10px;overflow:hidden">
    <tr><td style="background:${GREEN};padding:12px 20px;border-right:6px solid ${RED}">${logo}</td></tr>
    <tr><td style="padding:20px 20px 0">
      <h1 style="margin:0 0 6px;font-family:${FONT};font-weight:500;font-size:20px;line-height:1.15;text-transform:uppercase;color:${GREEN}">${isCustomer ? "Your POSM order" : "Order confirmation"}</h1>
      <p style="margin:0 0 16px;${VALUE};color:${GREY}">${intro}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${details}</table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px">
        <tr>
          <th align="left" style="padding:4px 0;border-bottom:2px solid ${GREEN};${LABEL};font-weight:500">Items</th>
          <th align="right" style="padding:4px 0;border-bottom:2px solid ${GREEN};${LABEL};font-weight:500">Qty</th>
        </tr>
        ${rows}
        ${total}
      </table>
      ${link}
      ${signOff}
    </td></tr>
    <tr><td style="padding:20px;font-family:${BODY_FONT};font-size:11px;color:${GREY}">Sirocco · POSM SHOP</td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export async function loadOrder(orderId: string) {
  const db = createAdminClient();
  const [{ data: order }, { data: items }] = await Promise.all([
    db.from("orders").select("*").eq("id", orderId).single(),
    db.from("order_items").select("*").eq("order_id", orderId).order("brand").order("name"),
  ]);
  if (!order) return null;
  const { data: market } = await db.from("markets").select("*").eq("code", order.market).single();
  return { order: order as Order, items: (items ?? []) as OrderItem[], market: market as Market };
}

export function orderDeskRecipients(market: Market) {
  const custom = (market.cs_email ?? "")
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  return custom.length ? custom : [DEFAULT_ORDER_DESK];
}

/**
 * Sends the two order emails: the confirmation to the KAM and the order desk (MMI Customer Service)
 * together, and a delivery note to the outlet contact.
 */
export async function sendOrderEmails(orderId: string) {
  const loaded = await loadOrder(orderId);
  if (!loaded) return { sent: 0, skipped: "Order not found" };
  const { order, items, market } = loaded;

  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — order emails skipped for", order.order_number);
    return { sent: 0, skipped: "Email is not configured (RESEND_API_KEY missing)" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.EMAIL_FROM ?? "POSM SHOP <onboarding@resend.dev>";

  const messages: { to: string[]; audience: Audience }[] = [
    { to: [order.kam_email, ...orderDeskRecipients(market)], audience: "kam" },
    { to: [order.contact_email], audience: "customer" },
  ];

  const results = await resend.batch.send(
    messages.map((m) => ({
      from,
      to: m.to,
      replyTo: order.kam_email,
      subject: emailSubject(order, m.audience),
      html: renderOrderEmail(order, items, market, m.audience),
    })),
  );

  if (results.error) {
    console.error("Order email failed", order.order_number, results.error);
    return { sent: 0, skipped: results.error.message };
  }

  await createAdminClient().from("orders").update({ emails_sent_at: new Date().toISOString() }).eq("id", order.id);
  return { sent: messages.length, skipped: null };
}
