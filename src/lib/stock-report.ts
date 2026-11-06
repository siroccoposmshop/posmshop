import "server-only";
import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * IT's stock report (e.g. "drink dynasty Report - November 2026", sheet "Stock and rolling forecast").
 * Headings sit on one of the first rows: ProductCode (A), Avg 12Mnth Sale (C), Stock (E). Columns are
 * found by heading, so the report can gain or move columns.
 *
 *   stock            = Stock
 *   months_of_stock  = Stock ÷ Avg 12Mnth Sale (blank when there were no sales)
 */

export type StockReportRow = { code: string; name: string; stock: number; avg12: number | null };

const cellText = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return String(v.result);
    if ("text" in v) return String(v.text);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    return "";
  }
  return String(v);
};
const cellNumber = (v: ExcelJS.CellValue): number | null => {
  const n = Number(cellText(v).replace(/[, ]/g, ""));
  return cellText(v).trim() !== "" && Number.isFinite(n) ? n : null;
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The report's rows, or null if this isn't a stock report (no ProductCode / Stock headings). */
export async function parseStockReport(buffer: ArrayBuffer): Promise<{ sheet: string; rows: StockReportRow[] } | null> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  for (const ws of wb.worksheets) {
    for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
      const heads = new Map<string, number>();
      ws.getRow(r).eachCell((cell, col) => {
        const h = norm(cellText(cell.value));
        if (h && !heads.has(h)) heads.set(h, col);
      });
      const code = heads.get("productcode");
      const stock = heads.get("stock");
      if (!code || !stock) continue;
      const avg12 = heads.get("avg12mnthsale") ?? [...heads].find(([h]) => /^avg12/.test(h))?.[1];
      const name = heads.get("description");
      const rows: StockReportRow[] = [];
      for (let i = r + 1; i <= ws.rowCount; i++) {
        const row = ws.getRow(i);
        const c = cellText(row.getCell(code).value).trim();
        const s = cellNumber(row.getCell(stock).value);
        if (!c || s === null) continue;
        rows.push({ code: c, name: name ? cellText(row.getCell(name).value).trim() : "", stock: s, avg12: avg12 ? cellNumber(row.getCell(avg12).value) : null });
      }
      return { sheet: ws.name, rows };
    }
  }
  return null;
}

export type StockRunSummary = {
  ok: boolean;
  /** Why nothing was changed, when ok is false. */
  reason?: string;
  file?: string;
  sheet?: string;
  rows: number;
  updated: number;
  /** Report codes with no POSM item (other products in the report). */
  unmatched: number;
  /** POSM items not in the report (left as they were). */
  notInReport: number;
  notInReportSample?: string[];
};

/**
 * Updates stock and months of stock for every POSM item whose SKU is a ProductCode in the report.
 * Nothing else changes. Stops without changing anything if the report matches no items, or under
 * half the items on sale, so a wrong or partial file can't wipe stock.
 */
export async function applyStockReport(
  report: { sheet: string; rows: StockReportRow[] },
  opts: { source: "stock_email" | "stock_upload"; file?: string; triggeredBy?: string | null },
): Promise<StockRunSummary> {
  const db = createAdminClient();
  const { data: run } = await db.from("sync_runs").insert({ source: opts.source, triggered_by: opts.triggeredBy ?? null }).select("id").single();
  const finish = async (summary: StockRunSummary) => {
    if (run) await db.from("sync_runs").update({ ok: summary.ok, summary, finished_at: new Date().toISOString() }).eq("id", run.id);
    return summary;
  };

  const { data: items, error } = await db.from("items").select("id, sku, visible");
  if (error) return finish({ ok: false, reason: error.message, file: opts.file, sheet: report.sheet, rows: report.rows.length, updated: 0, unmatched: 0, notInReport: 0 });
  const plan = planStockUpdate((items ?? []) as { id: string; sku: string; visible: boolean }[], report);
  const base = { file: opts.file, sheet: report.sheet, rows: report.rows.length, unmatched: plan.unmatched, notInReport: plan.notInReport.length, notInReportSample: plan.notInReport.slice(0, 15) };
  if (plan.stop) return finish({ ok: false, reason: plan.stop, updated: 0, ...base });

  let updated = 0;
  const now = new Date().toISOString();
  for (let i = 0; i < plan.updates.length; i += 20) {
    const batch = plan.updates.slice(i, i + 20);
    const results = await Promise.all(
      batch.map((u) => db.from("items").update({ stock: u.stock, months_of_stock: u.months_of_stock, updated_at: now }).eq("id", u.id)),
    );
    updated += results.filter((x) => !x.error).length;
  }
  return finish({ ok: true, updated, ...base });
}

/**
 * What a report would change, without touching the database: the updates, and a reason to stop
 * (no matches, or under half the items on sale in the report).
 */
export function planStockUpdate(items: { id: string; sku: string; visible: boolean }[], report: { rows: StockReportRow[] }) {
  const key = (s: string) => String(s).trim().toUpperCase();
  const bySku = new Map(items.map((i) => [key(i.sku), i]));
  const latest = new Map<string, StockReportRow>();
  for (const r of report.rows) latest.set(key(r.code), r);
  const updates = [...latest]
    .filter(([code]) => bySku.has(code))
    .map(([code, r]) => {
      const stock = Math.max(0, Math.floor(r.stock));
      return { id: bySku.get(code)!.id, sku: bySku.get(code)!.sku, stock, months_of_stock: r.avg12 && r.avg12 > 0 ? Math.round((stock / r.avg12) * 100) / 100 : null };
    });
  const visible = items.filter((i) => i.visible);
  const visibleIn = visible.filter((i) => latest.has(key(i.sku))).length;
  const stop = !updates.length
    ? "None of the report's product codes match a POSM item SKU."
    : visible.length >= 10 && visibleIn < visible.length / 2
      ? `Only ${visibleIn} of the ${visible.length} items on sale are in the report, so nothing was changed. Check it's the full report.`
      : null;
  return { updates, stop, unmatched: latest.size - updates.length, notInReport: items.filter((i) => !latest.has(key(i.sku))).map((i) => i.sku) };
}
