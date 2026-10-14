"use server";

import sharp from "sharp";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseMarket, parseWorkbook } from "@/lib/excel";
import { isAllowedEmail, slugify } from "@/lib/format";
import { MARKET_CODES } from "@/lib/markets";
import type { OrderStatus } from "@/lib/types";

const MARKETS = MARKET_CODES;
const BUCKET = "item-images";

// ---------------------------------------------------------------------------
// Excel import
// ---------------------------------------------------------------------------
export type ImportSummary = {
  filename: string;
  items: { created: number; updated: number; total: number };
  accounts: { created: number; updated: number; skipped: number; total: number };
  sheets: { name: string; kind: string; rows: number; columns: Record<string, string> }[];
  warnings: string[];
  missingFromFile: string[];
};

export async function importWorkbook(input: { path: string; filename: string; defaultMarket: string }): Promise<{ summary?: ImportSummary; error?: string }> {
  const admin = await requireAdmin();
  const defaultMarket = normaliseMarket(input.defaultMarket);
  if (!input.path || !input.filename.toLowerCase().endsWith(".xlsx")) {
    return { error: "Please upload an .xlsx file (Excel 2007 or later)." };
  }
  const { data: blob, error: dlError } = await createAdminClient().storage.from("imports").download(input.path);
  if (dlError || !blob) return { error: "The uploaded file couldn't be found. Please try again." };
  const file = { name: input.filename, arrayBuffer: () => blob.arrayBuffer() };

  let parsed;
  try {
    parsed = await parseWorkbook(await file.arrayBuffer());
  } catch (e) {
    console.error(e);
    return { error: "That file couldn't be read. Is it a valid .xlsx workbook?" };
  }

  const db = createAdminClient();
  const warnings = [...parsed.warnings];

  // Items — upsert by SKU. Excel overrides stock, value, names and category.
  // Admin-only settings (images, visibility, ETA) are never touched by the import.
  const { data: existingItems } = await db.from("items").select("sku");
  const existingSkus = new Set((existingItems ?? []).map((r) => r.sku as string));
  const itemRows = parsed.items.map((i) => {
    const row: Record<string, unknown> = {
      sku: i.sku,
      name: i.name,
      brand: i.brand,
      category: i.category,
      updated_at: new Date().toISOString(),
    };
    if (i.value !== null) row.value = i.value;
    if (i.stock !== null) row.stock = Math.max(0, Math.floor(i.stock));
    return row;
  });
  for (let i = 0; i < itemRows.length; i += 500) {
    const { error } = await db.from("items").upsert(itemRows.slice(i, i + 500), { onConflict: "sku" });
    if (error) return { error: `Saving items failed: ${error.message}` };
  }
  const fileSkus = new Set(parsed.items.map((i) => i.sku));
  const missingFromFile = parsed.items.length ? [...existingSkus].filter((s) => !fileSkus.has(s)) : [];

  // Accounts — upsert by account number.
  const { data: existingAccounts } = await db.from("accounts").select("account_number");
  const existingNumbers = new Set((existingAccounts ?? []).map((r) => r.account_number as string));
  let skipped = 0;
  const accountRows = parsed.accounts.flatMap((a) => {
    const market = a.market ?? defaultMarket;
    if (!market) {
      skipped++;
      return [];
    }
    return [
      {
        account_number: a.account_number,
        name: a.name,
        parent_number: a.parent_number,
        parent_name: a.parent_name,
        kam_name: a.kam_name,
        market,
        channel: a.channel,
        active: true,
        updated_at: new Date().toISOString(),
      },
    ];
  });
  if (skipped) warnings.push(`${skipped} accounts had no market and were skipped. Choose a default market and upload again to include them.`);
  for (let i = 0; i < accountRows.length; i += 500) {
    const { error } = await db.from("accounts").upsert(accountRows.slice(i, i + 500), { onConflict: "account_number" });
    if (error) return { error: `Saving accounts failed: ${error.message}` };
  }

  const summary: ImportSummary = {
    filename: file.name,
    items: {
      total: itemRows.length,
      created: parsed.items.filter((i) => !existingSkus.has(i.sku)).length,
      updated: parsed.items.filter((i) => existingSkus.has(i.sku)).length,
    },
    accounts: {
      total: accountRows.length,
      created: accountRows.filter((a) => !existingNumbers.has(a.account_number)).length,
      updated: accountRows.filter((a) => existingNumbers.has(a.account_number)).length,
      skipped,
    },
    sheets: parsed.sheets,
    warnings,
    missingFromFile,
  };

  await db.from("imports").insert({ filename: file.name, uploaded_by: admin.id, summary });
  revalidatePath("/admin", "layout");
  revalidatePath("/shop");
  return { summary };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
const itemSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  brand: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(80).optional().transform((v) => v || null),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
  value: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0),
  max_per_order: z
    .string()
    .optional()
    .transform((v) => (v && Number(v) > 0 ? Math.floor(Number(v)) : null)),
  order_multiple: z.coerce.number().int().min(1),
  eta: z.string().optional().transform((v) => v || null),
  visible: z.boolean(),
  markets: z.array(z.enum(MARKETS)),
});

export async function saveItem(_: unknown, formData: FormData): Promise<{ error?: string; ok?: boolean; id?: string }> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = itemSchema.safeParse({
    sku: formData.get("sku"),
    brand: formData.get("brand"),
    name: formData.get("name"),
    category: formData.get("category") ?? "",
    description: formData.get("description") ?? "",
    value: formData.get("value"),
    stock: formData.get("stock"),
    max_per_order: formData.get("max_per_order") ?? "",
    order_multiple: formData.get("order_multiple") || 1,
    eta: formData.get("eta") ?? "",
    visible: formData.get("visible") === "on",
    markets: formData.getAll("markets"),
  });
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const v = parsed.data;
  if (v.max_per_order !== null && v.max_per_order % v.order_multiple !== 0) {
    return { error: `Max per order (${v.max_per_order}) must be a multiple of the order multiple (${v.order_multiple}).` };
  }

  const db = createAdminClient();
  const row = { ...v, updated_at: new Date().toISOString() };
  const res = id
    ? await db.from("items").update(row).eq("id", id).select("id").single()
    : await db.from("items").insert(row).select("id").single();
  if (res.error) {
    return { error: res.error.code === "23505" ? `SKU ${v.sku} already exists.` : res.error.message };
  }
  revalidatePath("/admin/items");
  revalidatePath("/shop");
  return { ok: true, id: res.data.id };
}

export async function setItemVisibility(id: string, visible: boolean) {
  await requireAdmin();
  await createAdminClient().from("items").update({ visible, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/items");
  revalidatePath("/shop");
}

export async function deleteItem(id: string) {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db.from("items").select("image_path").eq("id", id).single();
  if (data?.image_path) await db.storage.from(BUCKET).remove([data.image_path]);
  const { error } = await db.from("items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/items");
  return { ok: true };
}

/** Converts any image to a 1200px-wide .webp. */
async function toWebp(file: File) {
  const input = Buffer.from(await file.arrayBuffer());
  return sharp(input).rotate().resize({ width: 1200 }).webp({ quality: 82 }).toBuffer();
}

async function storeItemImage(itemId: string, sku: string, previous: string | null, file: File) {
  const db = createAdminClient();
  const webp = await toWebp(file);
  const path = `${slugify(sku) || itemId}-${Date.now()}.webp`;
  const { error } = await db.storage.from(BUCKET).upload(path, webp, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(error.message);
  await db.from("items").update({ image_path: path, updated_at: new Date().toISOString() }).eq("id", itemId);
  if (previous) await db.storage.from(BUCKET).remove([previous]);
  return path;
}

export async function uploadItemImage(_: unknown, formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image." };
  if (!file.type.startsWith("image/")) return { error: "That file isn't an image." };
  const db = createAdminClient();
  const { data: item } = await db.from("items").select("id, sku, image_path").eq("id", id).single();
  if (!item) return { error: "Item not found." };
  try {
    await storeItemImage(item.id, item.sku, item.image_path, file);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed." };
  }
  revalidatePath(`/admin/items/${id}`);
  revalidatePath("/admin/items");
  revalidatePath("/shop");
  return { ok: true };
}

export async function removeItemImage(id: string) {
  await requireAdmin();
  const db = createAdminClient();
  const { data: item } = await db.from("items").select("image_path").eq("id", id).single();
  if (item?.image_path) {
    await db.storage.from(BUCKET).remove([item.image_path]);
    await db.from("items").update({ image_path: null, updated_at: new Date().toISOString() }).eq("id", id);
  }
  revalidatePath(`/admin/items/${id}`);
  revalidatePath("/admin/items");
  revalidatePath("/shop");
}

/** Bulk image upload (one file per call): the file name without extension must equal an item's SKU. */
export async function uploadImageForSku(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();
  const file = formData.get("image");
  const original = String(formData.get("originalName") ?? "");
  if (!(file instanceof File) || file.size === 0 || !file.type.startsWith("image/")) return { error: "Not an image" };
  const sku = original.replace(/\.[^.]+$/, "").trim();
  const db = createAdminClient();
  const { data: item } = await db.from("items").select("id, sku, image_path").ilike("sku", sku.replace(/[\\%_]/g, "\\$&")).maybeSingle();
  if (!item) return { error: "No matching SKU" };
  try {
    await storeItemImage(item.id, item.sku, item.image_path, file);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed" };
  }
  revalidatePath("/admin/items");
  revalidatePath("/shop");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export async function setOrderStatus(id: string, status: OrderStatus) {
  await requireAdmin();
  const allowed: OrderStatus[] = ["submitted", "processing", "dispatched", "delivered", "cancelled"];
  if (!allowed.includes(status)) return;
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("status").eq("id", id).single();
  if (!order) return;
  // Cancelling returns the stock; un-cancelling takes it again.
  if ((order.status === "cancelled") !== (status === "cancelled")) {
    const { data: lines } = await db.from("order_items").select("item_id, qty").eq("order_id", id);
    const sign = status === "cancelled" ? 1 : -1;
    for (const l of lines ?? []) {
      if (l.item_id) await db.rpc("adjust_item_stock", { p_item_id: l.item_id, p_delta: sign * l.qty });
    }
  }
  await db.from("orders").update({ status }).eq("id", id);
  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${id}`);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export async function saveUser(_: unknown, formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const me = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "kam";
  const marketRaw = String(formData.get("market") ?? "");
  const market = (MARKETS as readonly string[]).includes(marketRaw) ? marketRaw : null;
  const full_name = String(formData.get("full_name") ?? "").trim() || null;
  const active = formData.get("active") === "on";
  if (id === me.id && (role !== "admin" || !active)) return { error: "You can't remove your own admin access." };
  const { error } = await createAdminClient().from("profiles").update({ role, market, full_name, active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Pre-registers a user so their market/role is ready before their first sign-in. */
export async function inviteUser(_: unknown, formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isAllowedEmail(email)) return { error: "Only @sirocco.ae email addresses are allowed." };
  const role = formData.get("role") === "admin" ? "admin" : "kam";
  const marketRaw = String(formData.get("market") ?? "");
  const market = (MARKETS as readonly string[]).includes(marketRaw) ? marketRaw : null;
  const full_name = String(formData.get("full_name") ?? "").trim() || null;

  const db = createAdminClient();
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) return { error: error.message.includes("already") ? "That user already exists — edit them in the list." : error.message };
  const { error: upd } = await db.from("profiles").update({ role, market, full_name }).eq("id", data.user.id);
  if (upd) return { error: upd.message };
  revalidatePath("/admin/users");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Market settings
// ---------------------------------------------------------------------------
export async function saveMarket(_: unknown, formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const code = String(formData.get("code") ?? "");
  const cs_email = String(formData.get("cs_email") ?? "").trim() || null;
  const delivery_days = Math.max(1, Math.floor(Number(formData.get("delivery_days") ?? 7)));
  const currency = String(formData.get("currency") ?? "USD").trim().toUpperCase().slice(0, 3) || "USD";
  if (cs_email && !cs_email.split(/[,;\s]+/).filter(Boolean).every((e) => /^\S+@\S+\.\S+$/.test(e))) {
    return { error: "Enter valid email addresses, separated by commas." };
  }
  const { error } = await createAdminClient().from("markets").update({ cs_email, delivery_days, currency }).eq("code", code);
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}
