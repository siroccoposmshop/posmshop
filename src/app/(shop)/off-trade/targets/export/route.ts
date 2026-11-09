import ExcelJS from "exceljs";
import { requireProfile } from "@/lib/auth";
import { applyOffTradeFilters, canUseOffTrade, loadOffTrade, marketName, readOffTradeFilters, readTargetYear, storeLabel, targetRows } from "@/lib/off-trade";
import { asDate, plainCode, queryOf, styleSheet, xlsxResponse } from "@/lib/off-trade-export";

/** Targets as Excel: one row per target store, for the filters and year chosen on the page. */
export async function GET(req: Request) {
  const profile = await requireProfile();
  if (!canUseOffTrade(profile)) return new Response("Not allowed", { status: 403 });
  const q = queryOf(req);
  const year = readTargetYear(q.year);
  const rows = targetRows(applyOffTradeFilters(await loadOffTrade(), readOffTradeFilters(q)), year);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Targets ${year}`);
  ws.columns = [
    { header: "Store code", key: "code", width: 16 },
    { header: "Store", key: "label", width: 28 },
    { header: "Full name", key: "name", width: 38 },
    { header: "Chain", key: "chain", width: 20 },
    { header: "Market", key: "market", width: 16 },
    { header: "Area", key: "area", width: 12 },
    { header: "TM", key: "tm", width: 12 },
    { header: "Segment", key: "segment", width: 14 },
    { header: "Status", key: "status", width: 13 },
    { header: "Projects", key: "types", width: 26 },
    { header: "Items", key: "items", width: 8 },
    { header: "Items done", key: "itemsDone", width: 10 },
    { header: "Due quarter", key: "dueQ", width: 11 },
    { header: "Due", key: "due", width: 13 },
    { header: "Achieved", key: "done", width: 13 },
    { header: "Expected cost (AED)", key: "expected", width: 15 },
    { header: "Actual cost (AED)", key: "actual", width: 15 },
  ];
  for (const r of rows) {
    const s = r.store;
    ws.addRow({
      code: plainCode(s.code),
      label: storeLabel(s.name, s.chain),
      name: s.name,
      chain: s.chain ?? "",
      market: marketName(s.market),
      area: s.area ?? "",
      tm: s.tmam ?? "",
      segment: s.segment ?? "",
      status: r.achieved ? "Achieved" : r.tbc ? "Project tbc" : "Planned",
      types: r.types.join(", "),
      items: r.items || "",
      itemsDone: r.itemsDone || "",
      dueQ: r.dueQ ?? "",
      due: asDate(r.due),
      done: asDate(r.doneDate),
      expected: r.expected || "",
      actual: r.actual || "",
    });
  }
  for (const k of ["due", "done"]) ws.getColumn(k).numFmt = "dd mmm yyyy";
  for (const k of ["expected", "actual"]) ws.getColumn(k).numFmt = "#,##0";
  styleSheet(ws, 2);
  return xlsxResponse(wb, `off-trade-targets-${year}`);
}
