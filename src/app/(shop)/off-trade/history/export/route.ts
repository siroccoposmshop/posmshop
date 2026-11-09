import ExcelJS from "exceljs";
import { requireProfile } from "@/lib/auth";
import { applyOffTradeFilters, canUseOffTrade, executedYears, historyRows, loadOffTrade, marketName, readHistoryYear, readOffTradeFilters, storeLabel } from "@/lib/off-trade";
import { asDate, plainCode, queryOf, styleSheet, xlsxResponse } from "@/lib/off-trade-export";

/** History as Excel: one row per thing installed, for the filters and year chosen on the page. */
export async function GET(req: Request) {
  const profile = await requireProfile();
  if (!canUseOffTrade(profile)) return new Response("Not allowed", { status: 403 });
  const q = queryOf(req);
  const year = readHistoryYear(q.year);
  const stores = applyOffTradeFilters(await loadOffTrade(), readOffTradeFilters(q));
  const rows = historyRows(stores, year);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(year ? `Installed ${year}` : "Installed");
  ws.columns = [
    { header: "Completed", key: "date", width: 13 },
    { header: "Year", key: "year", width: 8 },
    { header: "Store code", key: "code", width: 16 },
    { header: "Store", key: "label", width: 28 },
    { header: "Full name", key: "name", width: 38 },
    { header: "Chain", key: "chain", width: 20 },
    { header: "Market", key: "market", width: 16 },
    { header: "Area", key: "area", width: 12 },
    { header: "TM", key: "tm", width: 12 },
    { header: "Bar", key: "bar", width: 7 },
    { header: "First time executed", key: "fresh", width: 12 },
    { header: "Category", key: "type", width: 14 },
    { header: "What", key: "item", width: 24 },
    { header: "Brand", key: "brand", width: 16 },
    { header: "Quantity", key: "qty", width: 9 },
    { header: "Actual cost (AED)", key: "cost", width: 14 },
    { header: "Notes", key: "notes", width: 40 },
  ];
  for (const r of rows) {
    const s = r.store;
    ws.addRow({
      date: asDate(r.project.completed_date),
      year: r.year ?? "",
      code: plainCode(s.code),
      label: storeLabel(s.name, s.chain),
      name: s.name,
      chain: s.chain ?? "",
      market: marketName(s.market),
      area: s.area ?? "",
      tm: s.tmam ?? "",
      bar: s.bar ? "Yes" : "",
      fresh: r.year && executedYears(s)[0] === r.year ? "Yes" : "",
      type: r.project.type,
      item: r.project.item ?? "",
      brand: r.project.brand ?? "",
      qty: r.qty,
      cost: r.project.actual_cost_aed != null ? Number(r.project.actual_cost_aed) : "",
      notes: r.project.notes ?? "",
    });
  }
  ws.getColumn("date").numFmt = "dd mmm yyyy";
  ws.getColumn("cost").numFmt = "#,##0";
  styleSheet(ws, 0);
  return xlsxResponse(wb, year ? `off-trade-history-${year}` : "off-trade-history");
}
