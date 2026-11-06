import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyStockReport, parseStockReport, type StockRunSummary } from "@/lib/stock-report";

/**
 * Stock by email. IT's stock report goes to the Resend receiving address; Resend calls
 * /api/inbound/stock (event email.received); we fetch the .xlsx attachment, apply it and email
 * the result to the POSM admins.
 *
 * Settings (Vercel environment variables):
 *   RESEND_WEBHOOK_SECRET  the webhook's signing secret (whsec_…), from Resend → Webhooks
 *   STOCK_EMAIL_SENDERS    who may send the report: addresses and/or @domains, comma-separated
 *   STOCK_EMAIL_NOTIFY     optional: who gets the result (default: every POSM admin)
 */

/** Resend signs webhooks the Svix way: HMAC-SHA256 of "id.timestamp.body" with the base64 secret. */
export function verifyWebhook(body: string, headers: Headers, secret: string) {
  const id = headers.get("svix-id") ?? headers.get("webhook-id");
  const ts = headers.get("svix-timestamp") ?? headers.get("webhook-timestamp");
  const sigs = headers.get("svix-signature") ?? headers.get("webhook-signature");
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 5 * 60) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sigs.split(" ").some((part) => {
    const sig = Buffer.from(part.split(",")[1] ?? "", "base64");
    return sig.length === expected.length && timingSafeEqual(sig, expected);
  });
}

/** "IT Reports <stock@mmi.ae>" → "stock@mmi.ae". */
export const emailAddress = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();

export function senderAllowed(from: string, allowList = process.env.STOCK_EMAIL_SENDERS ?? "") {
  const addr = emailAddress(from);
  const rules = allowList.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return rules.some((r) => (r.startsWith("@") ? addr.endsWith(r) : addr === r));
}

type Attachment = { id?: string; filename?: string; content_type?: string; download_url?: string; content?: string };

/** The received email's attachments (Resend Receiving API). */
async function listAttachments(emailId: string): Promise<Attachment[]> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY isn't set.");
  const get = async (path: string) => {
    const res = await fetch(`https://api.resend.com${path}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
    return res.ok ? ((await res.json()) as { data?: Attachment[]; attachments?: Attachment[] }) : null;
  };
  const list = (await get(`/emails/receiving/${emailId}/attachments`)) ?? (await get(`/emails/receiving/${emailId}`));
  return list?.data ?? list?.attachments ?? [];
}

async function download(a: Attachment): Promise<ArrayBuffer> {
  if (a.content) {
    const b = Buffer.from(a.content, "base64");
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  }
  if (!a.download_url) throw new Error("The attachment has no download link.");
  const res = await fetch(a.download_url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Couldn't download the attachment (${res.status}).`);
  return res.arrayBuffer();
}

/** Handles one received email: finds the report attachment and applies it. */
export async function handleStockEmail(event: { data?: { email_id?: string; id?: string; from?: string; subject?: string; attachments?: Attachment[] } }) {
  const data = event.data ?? {};
  const from = data.from ?? "";
  const emailId = data.email_id ?? data.id ?? "";
  if (!senderAllowed(from)) {
    console.warn("Stock email ignored: sender not allowed", from);
    return { ignored: true as const, reason: `Sender ${emailAddress(from) || "unknown"} isn't in STOCK_EMAIL_SENDERS.` };
  }
  let summary: StockRunSummary;
  try {
    const listed = data.attachments?.some((a) => a.download_url || a.content) ? data.attachments : await listAttachments(emailId);
    const file = (listed ?? []).find((a) => /\.xlsx$/i.test(a.filename ?? "") || /spreadsheetml/.test(a.content_type ?? ""));
    if (!file) throw new Error("The email had no .xlsx attachment.");
    const report = await parseStockReport(await download(file));
    if (!report) throw new Error(`${file.filename ?? "The attachment"} doesn't look like the stock report (no ProductCode / Stock headings).`);
    summary = await applyStockReport(report, { source: "stock_email", file: file.filename });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Something went wrong reading the email.";
    const db = createAdminClient();
    summary = { ok: false, reason, rows: 0, updated: 0, unmatched: 0, notInReport: 0 };
    await db.from("sync_runs").insert({ source: "stock_email", ok: false, summary, finished_at: new Date().toISOString() });
  }
  await notifyAdmins(summary, data.subject ?? "");
  return { summary };
}

async function notifyAdmins(s: StockRunSummary, subject: string) {
  if (!process.env.RESEND_API_KEY) return;
  let to = (process.env.STOCK_EMAIL_NOTIFY ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!to.length) {
    const { data } = await createAdminClient().from("profiles").select("email").eq("role", "admin").eq("active", true);
    to = (data ?? []).map((r) => r.email as string);
  }
  if (!to.length) return;
  const title = s.ok ? `Stock updated: ${s.updated} items` : "Stock NOT updated";
  const lines = s.ok
    ? [
        `${s.updated} POSM items updated from ${s.file ?? "the stock report"}.`,
        s.notInReport ? `${s.notInReport} items weren't in the report and kept their stock${s.notInReportSample?.length ? ` (e.g. ${s.notInReportSample.slice(0, 8).join(", ")})` : ""}.` : "",
        s.unmatched ? `${s.unmatched} other product codes in the report aren't POSM items (ignored).` : "",
      ]
    : [`Nothing was changed. ${s.reason ?? ""}`, subject ? `Email: ${subject}` : ""];
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#000;max-width:520px">
    <div style="background:${s.ok ? "#58a244" : "#cb3727"};color:#fff;padding:12px 16px;border-radius:8px 8px 0 0;font-weight:700;text-transform:uppercase">${title}</div>
    <div style="border:1px solid #eee;border-top:0;padding:14px 16px;border-radius:0 0 8px 8px">${lines.filter(Boolean).map((l) => `<p style="margin:0 0 8px">${l.replace(/</g, "&lt;")}</p>`).join("")}
    ${site ? `<p style="margin:12px 0 0"><a href="${site}/admin/import" style="color:#58a244">See the stock feed history</a></p>` : ""}</div></div>`;
  try {
    await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.EMAIL_FROM ?? "POSM SHOP <onboarding@resend.dev>", to, subject: title, html });
  } catch (e) {
    console.error("Stock result email failed", e);
  }
}
