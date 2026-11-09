import ExcelJS from "exceljs";
import { requireProfile } from "@/lib/auth";
import { queryOf, styleSheet, xlsxResponse } from "@/lib/off-trade-export";
import {
  TARGET_YEAR,
  VISIBILITY_MAIN,
  applyOffTradeFilters,
  canUseOffTrade,
  executedYears,
  loadOffTrade,
  marketName,
  readOffTradeFilters,
  storeLabel,
} from "@/lib/off-trade";

/** The off-trade stores list as Excel, for the filters chosen on the page. */
export async function GET(req: Request) {
  const profile = await requireProfile();
  if (!canUseOffTrade(profile)) return new Response("Not allowed", { status: 403 });
  const stores = applyOffTradeFilters(await loadOffTrade(), readOffTradeFilters(queryOf(req)));
  const years = [...new Set(stores.flatMap((s) => executedYears(s)))].filter((y) => y < TARGET_YEAR).sort();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Stores");
  ws.columns = [
    { header: "Store code", key: "code", width: 16 },
    { header: "Store", key: "label", width: 30 },
    { header: "Full name", key: "name", width: 40 },
    { header: "Chain", key: "chain", width: 20 },
    { header: "Market", key: "market", width: 16 },
    { header: "Area", key: "area", width: 12 },
    { header: "City", key: "city", width: 14 },
    { header: "TM", key: "tm", width: 12 },
    { header: "Segment", key: "segment", width: 14 },
    { header: "Store type", key: "type", width: 14 },
    { header: "Opened", key: "opened", width: 10 },
    { header: "Influenced", key: "influenced", width: 11 },
    ...VISIBILITY_MAIN.map((m) => ({ header: m, key: `v_${m}`, width: 11 })),
    { header: "Cold room", key: "cold", width: 11 },
    { header: "Cold room activated", key: "coldDone", width: 14 },
    ...years.map((y) => ({ header: `Executed ${y}`, key: `x_${y}`, width: 12 })),
    { header: "Covered (executed to date)", key: "covered", width: 14 },
    { header: "Last project", key: "lastType", width: 16 },
    { header: "Last project date", key: "lastDate", width: 14 },
    { header: `Target ${TARGET_YEAR}`, key: "target", width: 12 },
    { header: `${TARGET_YEAR} plan`, key: "plan", width: 24 },
    { header: `${TARGET_YEAR} expected cost (AED)`, key: "expected", width: 16 },
  ];
  const yes = (b: boolean) => (b ? "Yes" : "No");
  for (const s of stores) {
    const done = executedYears(s);
    const year = s.projects.filter((p) => p.status !== "cancelled" && (p.plan_year ?? Number((p.planned_date ?? p.completed_date ?? "").slice(0, 4))) === TARGET_YEAR);
    ws.addRow({
      code: s.code.startsWith("TBC-") ? "" : s.code,
      label: storeLabel(s.name, s.chain),
      name: s.name,
      chain: s.chain ?? "",
      market: marketName(s.market),
      area: s.area ?? "",
      city: s.city ?? "",
      tm: s.tmam ?? "",
      segment: s.segment ?? "",
      type: s.store_type ?? "",
      opened: s.opened_year ?? "",
      influenced: yes(s.influenced),
      ...Object.fromEntries(VISIBILITY_MAIN.map((m) => [`v_${m}`, s.vis.totals[m] || ""])),
      cold: yes(s.coldRoom),
      coldDone: s.coldRoomActivated ? new Date(s.coldRoomActivated) : "",
      ...Object.fromEntries(years.map((y) => [`x_${y}`, done.includes(y) ? (done[0] === y ? "Yes (new)" : "Yes") : ""])),
      covered: yes(done.length > 0),
      lastType: s.last?.type ?? "",
      lastDate: s.last?.completed_date ? new Date(s.last.completed_date) : "",
      target: yes(s.targeted),
      plan: [...new Set(year.map((p) => p.type))].join(", "),
      expected: year.reduce((n, p) => n + Number(p.expected_cost_aed ?? 0), 0) || "",
    });
  }
  styleSheet(ws, 2);
  for (const k of ["coldDone", "lastDate"]) ws.getColumn(k).numFmt = "dd mmm yyyy";
  ws.getColumn("expected").numFmt = "#,##0";

  return xlsxResponse(wb, "off-trade-stores");
}
