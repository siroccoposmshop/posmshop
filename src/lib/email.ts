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

export function emailSubject(order: Order, audience: Audience) {
  if (audience === "cs") return `[${order.market}] POSM order to execute: ${order.order_number} · ${order.account_name}`;
  if (audience === "customer") return `Your POSM order from Sirocco · ${order.order_number}`;
  return `Order placed: ${order.order_number} · ${order.account_name}`;
}

export function renderOrderEmail(order: Order, items: OrderItem[], market: Market, audience: Audience) {
  const intro =
    audience === "kam"
      ? `Here is the order you placed for <strong>${esc(order.account_name)}</strong>. Keep this email as your proof of execution.`
      : audience === "customer"
        ? `Dear ${esc(order.contact_name)},<br><br>Please see the POSM ordered for you. Delivery is expected in the next <strong>${market.delivery_days} days</strong>.`
        : `A new POSM order has been placed for ${esc(market.name)}. Please execute the order below.`;

  const heading = audience === "cs" ? "Order to execute" : audience === "customer" ? "Your POSM order" : "Order confirmation";

  const rows = items
    .map((i) => {
      const src = imageUrl(i.image_path);
      const img = src
        ? `<img src="${esc(src)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:contain;border-radius:6px;background:${LIGHT}">`
        : `<div style="width:64px;height:64px;border-radius:6px;background:${LIGHT}"></div>`;
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e3e3;width:76px">${img}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e3e3;font-family:${BODY_FONT};font-size:14px;color:#000">
          <strong>${esc(i.name)}</strong><br>
          <span style="font-size:12px;color:${GREY}">${esc(i.brand)} · SKU ${esc(i.sku)}</span>
        </td>
        <td align="right" style="padding:10px 8px;border-bottom:1px solid #e5e3e3;font-family:${BODY_FONT};font-size:14px;color:#000;white-space:nowrap">× ${i.qty}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #e5e3e3;font-family:${BODY_FONT};font-size:14px;color:#000;white-space:nowrap">${esc(money(i.line_value, order.currency))}</td>
      </tr>`;
    })
    .join("");

  const detail = (label: string, value: string) =>
    `<tr><td style="padding:3px 12px 3px 0;font-family:${FONT};font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:${GREY};white-space:nowrap;vertical-align:top">${label}</td><td style="padding:3px 0;font-family:${BODY_FONT};font-size:14px;color:#000">${value}</td></tr>`;

  const details = [
    detail("Order number", `<strong>${esc(order.order_number)}</strong>`),
    detail("Date", esc(formatDate(order.created_at, true))),
    detail("Account", `${esc(order.account_name)} (#${esc(order.account_number)})`),
    detail("Contact", `${esc(order.contact_name)} · ${esc(order.contact_mobile)} · ${esc(order.contact_email)}`),
    audience !== "customer" ? detail("KAM", `${esc(order.kam_name || order.kam_email)} · ${esc(order.kam_email)}`) : "",
    audience === "customer" ? detail("Your Sirocco contact", `${esc(order.kam_name || order.kam_email)} · ${esc(order.kam_email)}`) : "",
    detail("Market", esc(market.name)),
    order.notes && audience !== "customer" ? detail("Notes", esc(order.notes)) : "",
  ].join("");

  const link =
    audience !== "customer" && siteUrl()
      ? `<p style="margin:24px 0 0"><a href="${siteUrl()}/orders/${order.id}" style="display:inline-block;background:${GREEN};color:#fff;text-decoration:none;font-family:${FONT};text-transform:uppercase;letter-spacing:.04em;font-size:14px;padding:12px 22px;border-radius:999px">View order</a></p>`
      : "";

  const logo = siteUrl()
    ? `<img src="${siteUrl()}/email-logo-white.png" width="150" alt="SIROCCO" style="display:block;width:150px;height:auto">`
    : `<span style="font-family:${FONT};font-size:24px;font-weight:700;color:#fff;letter-spacing:.06em">SIROCCO</span>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(emailSubject(order, audience))}</title></head>
<body style="margin:0;padding:0;background:${LIGHT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:${GREEN};padding:22px 28px;border-right:10px solid ${RED}">${logo}</td></tr>
    <tr><td style="padding:28px 28px 8px">
      <h1 style="margin:0 0 12px;font-family:${FONT};font-weight:500;font-size:28px;line-height:1.1;text-transform:uppercase;color:${GREEN}">${heading}</h1>
      <p style="margin:0;font-family:${BODY_FONT};font-size:15px;line-height:1.5;color:${GREY}">${intro}</p>
    </td></tr>
    <tr><td style="padding:16px 28px">
      <table role="presentation" cellpadding="0" cellspacing="0">${details}</table>
    </td></tr>
    <tr><td style="padding:8px 28px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <th colspan="2" align="left" style="padding:6px 0;border-bottom:2px solid ${GREEN};font-family:${FONT};font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:${GREY}">Item</th>
          <th align="right" style="padding:6px 8px;border-bottom:2px solid ${GREEN};font-family:${FONT};font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:${GREY}">Qty</th>
          <th align="right" style="padding:6px 0;border-bottom:2px solid ${GREEN};font-family:${FONT};font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:${GREY}">Value</th>
        </tr>
        ${rows}
        <tr>
          <td colspan="3" align="right" style="padding:16px 8px 0;font-family:${FONT};font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:${GREY}">Total value</td>
          <td align="right" style="padding:16px 0 0;font-family:${FONT};font-size:20px;font-weight:700;color:#000;white-space:nowrap">${esc(money(order.total_value, order.currency))}</td>
        </tr>
      </table>
      ${link}
    </td></tr>
    <tr><td style="padding:28px;font-family:${BODY_FONT};font-size:12px;color:${GREY}">
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
