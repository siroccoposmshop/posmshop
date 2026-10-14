import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, imageUrl, money } from "@/lib/format";
import type { Market, Order, OrderItem } from "@/lib/types";

export type Audience = "kam" | "customer" | "cs";

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
  if (audience === "cs") return `[${order.market}] POSM order to execute: ${order.order_number} · ${outletLabel(order)}`;
  if (audience === "customer") return `Your POSM order for ${order.account_name} · ${order.order_number}`;
  return `Order placed: ${order.order_number} · ${outletLabel(order)}`;
}

const LABEL = `font-family:${FONT};font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${GREY}`;
const VALUE = `font-family:${BODY_FONT};font-size:15px;line-height:1.4;color:#000`;

/** A label stacked above its value: reads well at any width. */
function block(label: string, value: string) {
  return `<tr><td style="padding:0 0 14px"><div style="${LABEL}">${label}</div><div style="${VALUE};margin-top:2px">${value}</div></td></tr>`;
}

export function renderOrderEmail(order: Order, items: OrderItem[], market: Market, audience: Audience) {
  const isCustomer = audience === "customer";
  const venue = friendlyAccountName(order.parent_name);
  const outletAtVenue =
    venue && venue.toLowerCase() !== order.account_name.toLowerCase()
      ? `<strong>${esc(order.account_name)}</strong> at ${esc(venue)}`
      : `<strong>${esc(order.account_name)}</strong>`;
  const kam = order.kam_name || order.kam_email;

  const intro =
    audience === "kam"
      ? `Here is the order you placed for <strong>${esc(order.account_name)}</strong>${venue ? ` at ${esc(venue)}` : ""}. Keep this email as your proof of execution.`
      : isCustomer
        ? `Dear ${esc(firstName(order.contact_name))},<br><br>Please see the POSM ordered for ${outletAtVenue}. Delivery is expected in the next <strong>${market.delivery_days} days</strong>.`
        : `A new POSM order has been placed for ${esc(market.name)}. Please execute the order below.`;

  const heading = audience === "cs" ? "Order to execute" : isCustomer ? "Your POSM order" : "Order confirmation";

  const rows = items
    .map((i) => {
      const src = imageUrl(i.image_path);
      const img = src
        ? `<img src="${esc(src)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;object-fit:contain;border-radius:6px;background:${LIGHT}">`
        : `<div style="width:56px;height:56px;border-radius:6px;background:${LIGHT}"></div>`;
      const right = isCustomer
        ? `<strong>× ${i.qty}</strong>`
        : `<strong>× ${i.qty}</strong><br><span style="font-size:13px;color:${GREY}">${esc(money(i.line_value, order.currency))}</span>`;
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #e5e3e3;width:56px;vertical-align:top">${img}</td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e3e3;font-family:${BODY_FONT};font-size:14px;line-height:1.35;color:#000;vertical-align:top">
          <strong>${esc(i.name)}</strong><br>
          <span style="font-size:12px;color:${GREY}">${esc(i.brand)} · ${esc(i.sku)}</span>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #e5e3e3;font-family:${BODY_FONT};font-size:15px;line-height:1.35;color:#000;white-space:nowrap;vertical-align:top">${right}</td>
      </tr>`;
    })
    .join("");

  const total = isCustomer
    ? ""
    : `<tr>
          <td colspan="2" align="right" style="padding:16px 10px 0;${LABEL};font-size:13px">Total value</td>
          <td align="right" style="padding:16px 0 0;font-family:${FONT};font-size:20px;font-weight:700;color:#000;white-space:nowrap">${esc(money(order.total_value, order.currency))}</td>
        </tr>`;

  const contact = `${esc(order.contact_name)}<br>${esc(order.contact_mobile)}<br>${esc(order.contact_email)}`;

  // Order number and date side by side (both short), everything else stacked.
  const top = `<tr><td style="padding:0 0 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="50%" style="vertical-align:top"><div style="${LABEL}">Order number</div><div style="${VALUE};margin-top:2px"><strong>${esc(order.order_number)}</strong></div></td>
      <td width="50%" style="vertical-align:top"><div style="${LABEL}">Date</div><div style="${VALUE};margin-top:2px">${esc(formatDate(order.created_at, true))}</div></td>
    </tr></table></td></tr>`;

  const details = isCustomer
    ? [
        top,
        block("Delivering to", `<strong>${esc(order.account_name)}</strong>${venue ? `<br>${esc(venue)}` : ""}`),
        block("Contact for delivery", contact),
      ].join("")
    : [
        top,
        block("Outlet", `<strong>${esc(order.account_name)}</strong> · #${esc(order.account_number)}`),
        block("Account", `${esc(order.parent_name ?? order.account_name)} · #${esc(order.parent_number ?? order.account_number)}`),
        block("Contact at outlet", contact),
        audience === "cs" ? block("KAM", `${esc(kam)}<br>${esc(order.kam_email)}`) : "",
        block("Market", esc(market.name)),
        order.notes ? block("Notes", esc(order.notes)) : "",
      ].join("");

  const signOff = isCustomer
    ? `<p style="margin:28px 0 0;font-family:${BODY_FONT};font-size:15px;line-height:1.5;color:${GREY}">
        Any questions about your delivery? Just reply to this email.<br><br>
        Kind regards,<br>
        <strong style="color:#000">${esc(kam)}</strong><br>
        Sirocco · <a href="mailto:${esc(order.kam_email)}" style="color:${GREEN}">${esc(order.kam_email)}</a>
      </p>`
    : "";

  const link =
    !isCustomer && siteUrl()
      ? `<p style="margin:24px 0 0"><a href="${siteUrl()}/orders/${order.id}" style="display:inline-block;background:${GREEN};color:#fff;text-decoration:none;font-family:${FONT};text-transform:uppercase;letter-spacing:.04em;font-size:14px;padding:12px 22px;border-radius:999px">View order</a></p>`
      : "";

  const logo = siteUrl()
    ? `<img src="${siteUrl()}/email-logo-white.png" width="140" alt="SIROCCO" style="display:block;width:140px;height:auto">`
    : `<span style="font-family:${FONT};font-size:24px;font-weight:700;color:#fff;letter-spacing:.06em">SIROCCO</span>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(emailSubject(order, audience))}</title></head>
<body style="margin:0;padding:0;background:${LIGHT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT}"><tr><td align="center" style="padding:20px 10px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:${GREEN};padding:20px 24px;border-right:10px solid ${RED}">${logo}</td></tr>
    <tr><td style="padding:26px 24px 6px">
      <h1 style="margin:0 0 12px;font-family:${FONT};font-weight:500;font-size:26px;line-height:1.1;text-transform:uppercase;color:${GREEN}">${heading}</h1>
      <p style="margin:0;font-family:${BODY_FONT};font-size:15px;line-height:1.5;color:${GREY}">${intro}</p>
    </td></tr>
    <tr><td style="padding:18px 24px 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${details}</table>
    </td></tr>
    <tr><td style="padding:0 24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <th colspan="2" align="left" style="padding:6px 0;border-bottom:2px solid ${GREEN};${LABEL};font-weight:500">Items</th>
          <th align="right" style="padding:6px 0;border-bottom:2px solid ${GREEN};${LABEL};font-weight:500">Qty</th>
        </tr>
        ${rows}
        ${total}
      </table>
      ${link}
      ${signOff}
    </td></tr>
    <tr><td style="padding:26px 24px;font-family:${BODY_FONT};font-size:12px;color:${GREY}">
      Sirocco · Food and Beverage Services · Business Bay, Dubai<br>Sent by POSM SHOP.
    </td></tr>
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

/**
 * Sends the three order outputs: KAM (proof of execution), customer contact,
 * and the Customer Service mailbox for the order's market.
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
  const csRecipients = (market.cs_email ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const messages: { to: string[]; audience: Audience }[] = [
    { to: [order.kam_email], audience: "kam" },
    { to: [order.contact_email], audience: "customer" },
  ];
  if (csRecipients.length) messages.push({ to: csRecipients, audience: "cs" });

  const results = await resend.batch.send(
    messages.map((m) => ({
      from,
      to: m.to,
      replyTo: m.audience === "customer" ? order.kam_email : undefined,
      subject: emailSubject(order, m.audience),
      html: renderOrderEmail(order, items, market, m.audience),
    })),
  );

  if (results.error) {
    console.error("Order email failed", order.order_number, results.error);
    return { sent: 0, skipped: results.error.message };
  }

  await createAdminClient().from("orders").update({ emails_sent_at: new Date().toISOString() }).eq("id", order.id);
  return {
    sent: messages.length,
    skipped: csRecipients.length ? null : `No Customer Service email set for ${market.name}`,
  };
}
