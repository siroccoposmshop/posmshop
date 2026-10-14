import "server-only";
import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReportFilters = {
  from?: string;
  to?: string;
  market?: string;
  kam?: string;
  account?: string;
  brand?: string;
  category?: string;
  sku?: string;
  status?: string;
};

export type ReportRow = {
  order_number: string;
  created_at: string;
  status: string;
  market: string;
  kam_email: string;
  kam_name: string | null;
  account_number: string;
  account_name: string;
  parent_number: string | null;
  parent_name: string | null;
  contact_name: string;
  brand: string;
  category: string | null;
  sku: string;
  name: string;
  qty: number;
  unit_value: number;
  line_value: number;
};

export const FILTER_KEYS: (keyof ReportFilters)[] = ["from", "to", "market", "kam", "account", "brand", "category", "sku", "status"];

export function readFilters(sp: Record<string, string | string[] | undefined>): ReportFilters {
  const f: ReportFilters = {};
  for (const k of FILTER_KEYS) {
    const v = sp[k];
    if (typeof v === "string" && v.trim()) f[k] = v.trim();
  }
  return f;
}

export async function getReportRows(f: ReportFilters, limit = 50000): Promise<ReportRow[]> {
  const db = createAdminClient();
  const build = () => {
    let q = db
      .from("order_items")
      .select(
        "id, sku, brand, name, category, qty, unit_value, line_value, orders!inner(order_number, created_at, status, market, kam_id, kam_email, kam_name, account_number, account_name, parent_number, parent_name, contact_name)",
      )
      .order("id");
    if (f.from) q = q.gte("orders.created_at", `${f.from}T00:00:00+04:00`);
    if (f.to) q = q.lte("orders.created_at", `${f.to}T23:59:59+04:00`);
    if (f.market) q = q.eq("orders.market", f.market);
    if (f.kam) q = q.eq("orders.kam_id", f.kam);
    if (f.status) q = q.eq("orders.status", f.status);
    else q = q.neq("orders.status", "cancelled");
    if (f.account) {
      const a = f.account.replace(/[%,()]/g, " ");
      q = q.or(`account_number.ilike.%${a}%,account_name.ilike.%${a}%,parent_name.ilike.%${a}%`, { referencedTable: "orders" });
    }
    if (f.brand) q = q.eq("brand", f.brand);
    if (f.category) q = q.eq("category", f.category);
    if (f.sku) {
      const s = f.sku.replace(/[%,()]/g, " ");
      q = q.or(`sku.ilike.%${s}%,name.ilike.%${s}%`);
    }
    return q;
  };

  // PostgREST caps each response (1000 rows by default), so page through.
  const PAGE = 1000;
  const raw: NonNullable<Awaited<ReturnType<typeof build>>["data"]> = [];
  for (let offset = 0; offset < limit; offset += PAGE) {
    const { data, error } = await build().range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    raw.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  return raw
    .map((r) => {
      const o = r.orders as unknown as Omit<ReportRow, "brand" | "category" | "sku" | "name" | "qty" | "unit_value" | "line_value">;
      return {
        order_number: o.order_number,
        created_at: o.created_at,
        status: o.status,
        market: o.market,
        kam_email: o.kam_email,
        kam_name: o.kam_name,
        account_number: o.account_number,
        account_name: o.account_name,
        parent_number: o.parent_number,
        parent_name: o.parent_name,
        contact_name: o.contact_name,
        brand: r.brand,
        category: r.category,
        sku: r.sku,
        name: r.name,
        qty: r.qty,
        unit_value: Number(r.unit_value),
        line_value: Number(r.line_value),
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.order_number.localeCompare(b.order_number));
}

export function summariseByItem(rows: ReportRow[]) {
  const map = new Map<string, { sku: string; brand: string; name: string; category: string | null; qty: number; value: number; orders: Set<string> }>();
  for (const r of rows) {
    const e = map.get(r.sku) ?? { sku: r.sku, brand: r.brand, name: r.name, category: r.category, qty: 0, value: 0, orders: new Set<string>() };
    e.qty += r.qty;
    e.value += r.line_value;
    e.orders.add(r.order_number);
    map.set(r.sku, e);
  }
  return [...map.values()].map((e) => ({ ...e, orders: e.orders.size })).sort((a, b) => b.value - a.value);
}

export function summariseByKam(rows: ReportRow[]) {
  const map = new Map<string, { kam: string; qty: number; value: number; orders: Set<string> }>();
  for (const r of rows) {
    const key = r.kam_email;
    const e = map.get(key) ?? { kam: r.kam_name || r.kam_email, qty: 0, value: 0, orders: new Set<string>() };
    e.qty += r.qty;
    e.value += r.line_value;
    e.orders.add(r.order_number);
    map.set(key, e);
  }
  return [...map.values()].map((e) => ({ ...e, orders: e.orders.size })).sort((a, b) => b.value - a.value);
}

const COLUMNS: { header: string; key: keyof ReportRow | "date"; width: number }[] = [
  { header: "Order number", key: "order_number", width: 22 },
  { header: "Date", key: "date", width: 18 },
  { header: "Status", key: "status", width: 12 },
  { header: "Market", key: "market", width: 8 },
  { header: "KAM", key: "kam_name", width: 22 },
  { header: "KAM email", key: "kam_email", width: 28 },
  { header: "Parent number", key: "parent_number", width: 14 },
  { header: "Parent account", key: "parent_name", width: 40 },
  { header: "Outlet number", key: "account_number", width: 16 },
  { header: "Outlet", key: "account_name", width: 32 },
  { header: "Contact", key: "contact_name", width: 22 },
  { header: "Brand", key: "brand", width: 16 },
  { header: "Category", key: "category", width: 16 },
  { header: "SKU", key: "sku", width: 16 },
  { header: "Item", key: "name", width: 32 },
  { header: "Qty", key: "qty", width: 8 },
  { header: "Unit value", key: "unit_value", width: 12 },
  { header: "Line value", key: "line_value", width: 12 },
];

function dubaiTime(iso: string) {
  return new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Dubai" }).slice(0, 16);
}

export function toCsv(rows: ReportRow[]) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [COLUMNS.map((c) => c.header).join(",")];
  for (const r of rows) {
    lines.push(COLUMNS.map((c) => esc(c.key === "date" ? dubaiTime(r.created_at) : r[c.key])).join(","));
  }
  return "﻿" + lines.join("\r\n");
}

export async function toXlsx(rows: ReportRow[]) {
  const wb = new ExcelJS.Workbook();
  const lines = wb.addWorksheet("Order lines");
  lines.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  for (const r of rows) lines.addRow({ ...r, date: dubaiTime(r.created_at) });

  const items = wb.addWorksheet("By item");
  items.columns = [
    { header: "SKU", key: "sku", width: 16 },
    { header: "Brand", key: "brand", width: 16 },
    { header: "Item", key: "name", width: 32 },
    { header: "Category", key: "category", width: 16 },
    { header: "Orders", key: "orders", width: 10 },
    { header: "Qty", key: "qty", width: 10 },
    { header: "Value", key: "value", width: 14 },
  ];
  summariseByItem(rows).forEach((r) => items.addRow(r));

  const kams = wb.addWorksheet("By KAM");
  kams.columns = [
    { header: "KAM", key: "kam", width: 28 },
    { header: "Orders", key: "orders", width: 10 },
    { header: "Qty", key: "qty", width: 10 },
    { header: "Value", key: "value", width: 14 },
  ];
  summariseByKam(rows).forEach((r) => kams.addRow(r));

  for (const ws of [lines, items, kams]) {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF58A244" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  return wb.xlsx.writeBuffer();
}
