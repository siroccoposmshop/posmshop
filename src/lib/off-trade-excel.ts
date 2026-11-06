import "server-only";
import ExcelJS from "exceljs";
import { OFF_TRADE_PROJECT_TYPES, SEGMENTS, TARGET_YEAR } from "@/lib/off-trade";

/**
 * Off-trade upload. Headings are matched loosely (case, spaces and punctuation ignored), so the
 * columns can be in any order.
 *  - Stores sheet (any sheet with a store code heading): Store code, Store name, Chain, Market,
 *    Area, TM (Trade Marketing person), Segment, Influence (Y/N), Target year (e.g. 2027, or Y for the
 *    current target year), Visit frequency.
 *  - Projects sheet (a sheet named "Projects", optional): Store code, Type, Status, Year,
 *    Planned date, Completed date, Expected cost, Actual cost, Notes.
 */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const OPENED_HEADINGS = ["openingyear", "yearopened", "openedyear", "opened", "openedin", "opening", "openingdate", "opendate", "dateopened", "yearofopening"];
/** "2026", 2026 or a date → 2026. */
export function openedYear(raw: string): number | null {
  const m = raw.trim().match(/\b(19[5-9]\d|20\d\d)\b/);
  return m ? Number(m[1]) : null;
}
const STORE_FIELDS: Record<string, string[]> = {
  code: ["storecode", "code", "storeno", "storenumber", "accountnumber", "accountno", "outletcode", "outletnumber", "storeid"],
  name: ["storename", "name", "store", "outletname", "outlet"],
  chain: ["chain", "retailer", "customer", "banner", "parent", "account"],
  market: ["market", "country", "emirate"],
  area: ["area", "territory", "region", "zone", "cluster"],
  tmam: ["tm", "tmam", "trademarketing", "activationmanager", "tmactivationmanager", "owner"],
  target_year: ["targetyear", "target", "target2027", "targetstore", "targeted"],
  segment: ["segment", "storesegment", "tier"],
  influenced: ["influence", "influenced", "influencestatus"],
  visit_frequency: ["visitfrequency", "frequency", "visits", "journeyplan"],
  opened_year: OPENED_HEADINGS,
};
const PROJECT_FIELDS: Record<string, string[]> = {
  code: STORE_FIELDS.code,
  name: ["storename", "store", "outletname", "outlet"],
  chain: ["chain", "customer", "retailer", "banner"],
  type: ["type", "projecttype", "project", "activity", "category", "maincategory"],
  item: ["item", "asset", "unit", "element", "subcategory", "detail"],
  brand: ["brand"],
  quantity: ["quantity", "qty", "units", "number", "count", "noofunits"],
  status: ["status"],
  plan_year: ["year", "planyear", "targetyear"],
  planned_date: ["planneddate", "plandate", "executiondate", "plannedexecution", "plannedmonth"],
  completed_date: ["completeddate", "completiondate", "donedate", "dateexecuted", "executed"],
  expected_cost_aed: ["expectedcost", "expectedcostaed", "budget", "estimatedcost", "plannedcost"],
  actual_cost_aed: ["actualcost", "actualcostaed", "realcost", "finalcost", "cost"],
  notes: ["notes", "comments", "comment", "description"],
};

const text = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return text(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    return "";
  }
  return String(v).trim();
};
const num = (s: string) => {
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return s.trim() && Number.isFinite(n) ? n : null;
};
function date(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // dd/mm/yyyy
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const serial = Number(s); // Excel serial day
  if (Number.isFinite(serial) && serial > 30000 && serial < 80000) return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
const yes = (s: string) => /^(y|yes|true|1|influenced|influence)$/i.test(s.trim());
const segment = (s: string) => {
  const t = s.trim().toLowerCase();
  return SEGMENTS.find((x) => x.name.toLowerCase() === t || x.short.toLowerCase() === t)?.name ?? (s.trim() || null);
};
/** Free text → a project type ("Perfect Shelves" → Perfect shelf, "FSUs" → FSU, "Coolers" → Fridge). */
const projectType = (s: string) =>
  OFF_TRADE_PROJECT_TYPES.find((t) => norm(t) === norm(s)) ??
  (/take\s*over/i.test(s)
    ? "Takeover"
    : /shel(f|v)|planogram/i.test(s)
    ? "Perfect shelf"
    : /cold\s*room/i.test(s)
      ? "Cold room"
      : /fridge|cooler|chiller/i.test(s)
        ? "Fridge"
        : /fsu|floor\s*stand/i.test(s)
          ? "FSU"
          : /brand|visib|light\s*box|pallet|wall/i.test(s)
            ? "Branding"
            : s.trim()
              ? "Other"
              : null);
const status = (s: string, completed: string | null) => {
  const t = norm(s);
  if (/complete|done|executed|installed/.test(t) || (!t && completed)) return "completed";
  if (/progress|ongoing|wip/.test(t)) return "in_progress";
  if (/cancel/.test(t)) return "cancelled";
  return "planned";
};

function readSheet(ws: ExcelJS.Worksheet, fields: Record<string, string[]>) {
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const cols = new Map<string, number>();
    ws.getRow(r).eachCell((cell, c) => {
      const h = norm(text(cell.value));
      for (const [key, aliases] of Object.entries(fields)) if (!cols.has(key) && aliases.includes(h)) cols.set(key, c);
    });
    // A sheet needs a store code column, or (for projects) a store name to match on.
    if (!cols.has("code") && !(fields === PROJECT_FIELDS && cols.has("name"))) continue;
    const rows: Record<string, string>[] = [];
    for (let i = r + 1; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const o: Record<string, string> = {};
      for (const [k, c] of cols) o[k] = text(row.getCell(c).value);
      if (o.code || o.name) rows.push({ ...o, code: o.code ?? "" });
    }
    return { rows, found: [...cols.keys()] };
  }
  return null;
}

export type ParsedStore = {
  code: string;
  name: string;
  chain: string | null;
  market: string | null;
  area: string | null;
  tmam: string | null;
  segment: string | null;
  influenced: boolean;
  visit_frequency: string | null;
  target_year: number | null;
  /** Only when the sheet has an opening-year column. */
  opened_year?: number | null;
};

/** "Dubai" → DXB, "Oman" → OM, "Duty Free" → DF …; codes are kept as they are. */
function marketCode(raw: string | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const n = norm(t);
  const known: [RegExp, string][] = [
    [/^(dxb|dubai)$/, "DXB"],
    [/^(auh|abudhabi|alain)$/, "AUH"],
    [/^(ne|ner|northernemirates|rak|rasalkhaimah|sharjah|ajman|uaq|fujairah)$/, "NE"],
    [/^(om|oman|muscat)$/, "OM"],
    [/^(bh|bah|bahrain)$/, "BH"],
    [/^(qa|qt|qatar|doha)$/, "QA"],
  ];
  return known.find(([re]) => re.test(n))?.[1] ?? t.toUpperCase();
}

/** "2027" → 2027; "Y" / "Yes" → the current target year; blank / "N" → none. */
function targetYear(raw: string): number | null {
  const y = Number(raw.trim());
  if (y > 2000 && y < 2100) return Math.round(y);
  return yes(raw) ? TARGET_YEAR : null;
}
export type ParsedProject = {
  code: string;
  /** Store name (and chain) to match on when there's no store code yet. */
  name: string | null;
  chain: string | null;
  type: string;
  item: string | null;
  brand: string | null;
  quantity: number | null;
  status: string;
  plan_year: number | null;
  planned_date: string | null;
  completed_date: string | null;
  expected_cost_aed: number | null;
  actual_cost_aed: number | null;
  notes: string | null;
};

export async function parseOffTradeWorkbook(buffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const projectSheet = wb.worksheets.find((w) => /project|history|install/i.test(w.name));
  const storeSheet = wb.worksheets.find((w) => w !== projectSheet && readSheet(w, STORE_FIELDS)?.found.includes("name"));
  const warnings: string[] = [];

  const stores: ParsedStore[] = [];
  const sheet = storeSheet ? readSheet(storeSheet, STORE_FIELDS) : null;
  const storeColumns = sheet?.found ?? [];
  if (sheet) {
    for (const r of sheet.rows) {
      if (!r.name) {
        warnings.push(`Store ${r.code} has no name, skipped.`);
        continue;
      }
      stores.push({
        code: r.code,
        name: r.name,
        chain: r.chain || null,
        market: marketCode(r.market),
        area: r.area || null,
        tmam: r.tmam || null,
        segment: r.segment ? segment(r.segment) : null,
        influenced: r.influenced ? yes(r.influenced) : false,
        visit_frequency: r.visit_frequency || null,
        target_year: targetYear(r.target_year ?? ""),
        opened_year: openedYear(r.opened_year ?? ""),
      });
    }
  }

  const projects: ParsedProject[] = [];
  const ps = projectSheet ? readSheet(projectSheet, PROJECT_FIELDS) : null;
  for (const r of ps?.rows ?? []) {
    const type = projectType(r.type ?? "");
    if (!type) {
      warnings.push(`A project for store ${r.code} has no type, skipped.`);
      continue;
    }
    const completed = date(r.completed_date ?? "");
    const planned = date(r.planned_date ?? "");
    const qty = num(r.quantity ?? "");
    projects.push({
      code: r.code,
      name: r.name || null,
      chain: r.chain || null,
      type,
      item: r.item || null,
      brand: r.brand || null,
      quantity: qty && qty > 0 ? Math.round(qty) : null,
      status: status(r.status ?? "", completed),
      plan_year: num(r.plan_year ?? "") ?? (planned ? Number(planned.slice(0, 4)) : null),
      planned_date: planned,
      completed_date: completed,
      expected_cost_aed: num(r.expected_cost_aed ?? ""),
      actual_cost_aed: num(r.actual_cost_aed ?? ""),
      notes: r.notes || null,
    });
  }
  if (!storeSheet && !ps) warnings.push("No sheet with a store code heading was found.");
  return { stores, storeColumns, projects, warnings, storeSheet: storeSheet?.name ?? null, projectSheet: projectSheet?.name ?? null };
}

export async function buildOffTradeTemplate() {
  const wb = new ExcelJS.Workbook();
  const s = wb.addWorksheet("Stores");
  s.columns = ["Store code", "Store name", "Chain", "Market", "Area", "TM", "Segment", "Influence", "Target year", "Visit frequency"].map((h) => ({ header: h, width: 18 }));
  s.addRow(["AE-0001", "African + Eastern Jumeirah", "African + Eastern", "DXB", "DXB Retail", "Jithin", "Premium", "Y", 2027, "Weekly"]);
  const p = wb.addWorksheet("Projects");
  p.columns = ["Store code", "Type", "Status", "Year", "Planned date", "Completed date", "Expected cost", "Actual cost", "Notes"].map((h) => ({ header: h, width: 16 }));
  p.addRow(["AE-0001", "Perfect shelf", "Completed", 2026, "", "2026-03-15", 12000, 11500, "Cold + ambient planogram"]);
  p.addRow(["AE-0001", "Branding", "Planned", 2027, "2027-04-01", "", 25000, "", "Window and gondola ends"]);
  for (const ws of [s, p]) {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF58A244" } };
  }
  return wb.xlsx.writeBuffer();
}

// ---------------------------------------------------------------------------
// Visibility Master File (Off Trade Gulf Store List)
// ---------------------------------------------------------------------------

/**
 * The "Visibility Master File" tab: row with Channel · City · Customer · Store · Store Type ·
 * Segmentation · Responsibility · Visibility, then asset columns. The row above names each asset
 * group (Cold Room, Perfect Shelf - Warm Units, Fridge, Wall Branding, FSU …); the heading row
 * names the brand ("Heineken2" → Heineken). Cells hold 1 / a quantity / "Yes".
 * Rows without a channel, store and TM (the totals at the bottom) are skipped.
 */
export type ParsedVisibilityStore = ParsedStore & {
  city: string | null;
  store_type: string | null;
  visibility: Record<string, Record<string, number>>;
  visibility_flag: string | null;
  match_key: string;
};

const CHANNEL: Record<string, { market: string; area: string }> = {
  dxbr: { market: "DXB", area: "DXB Retail" },
  dxbretail: { market: "DXB", area: "DXB Retail" },
  dxbir: { market: "DXB", area: "DXB IR" },
  adr: { market: "AUH", area: "AUH" },
  auh: { market: "AUH", area: "AUH" },
  ner: { market: "NE", area: "NER" },
  ne: { market: "NE", area: "NER" },
  oman: { market: "OM", area: "Oman" },
  bahrain: { market: "BH", area: "Bahrain" },
  qatar: { market: "QA", area: "Qatar" },
};

export const matchKey = (channel: string, customer: string, store: string, type: string) =>
  [channel, customer, store, type].map((x) => x.trim().toLowerCase().replace(/\s+/g, " ")).join("|");

export function parseVisibilityMaster(ws: ExcelJS.Worksheet): { stores: ParsedVisibilityStore[]; groups: string[]; hasOpened: boolean } | null {
  for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
    const heads = new Map<string, number>();
    ws.getRow(r).eachCell((cell, c) => {
      const h = norm(text(cell.value));
      if (h && !heads.has(h)) heads.set(h, c);
    });
    const col = (...names: string[]) => names.map((n) => heads.get(n)).find((x) => x !== undefined);
    const channel = col("channel");
    const store = col("store", "storename");
    const tm = col("responsibility", "tm", "tmam");
    if (!channel || !store || !tm) continue;
    const city = col("city");
    const customer = col("customer", "chain", "retailer");
    const type = col("storetype", "type");
    const seg = col("segmentation", "segment");
    const flag = col("visibility");
    const code = col("storecode", "code", "uniquecode", "storeid", "accountnumber");
    const opened = col(...OPENED_HEADINGS);
    const fixed = new Set([channel, store, tm, city, customer, type, seg, flag, code, opened].filter((x): x is number => !!x));
    // Asset columns start after the store details (an opening-year column may be added at the end).
    const detailsEnd = Math.max(...[channel, store, tm, city, customer, type, seg, flag, code].filter((x): x is number => !!x));

    // Asset columns: after the fixed columns, with an asset group above (merged group headings
    // repeat across their columns). A column with no group above, e.g. the sheet's total, is skipped.
    const groupRow = ws.getRow(r - 1);
    const assetCols: { col: number; group: string; brand: string }[] = [];
    ws.getRow(r).eachCell((cell, c) => {
      if (fixed.has(c) || c < detailsEnd) return;
      const above = text(groupRow.getCell(c).value).trim();
      const head = text(cell.value).trim();
      if (!above || /^(total|sum|count)/i.test(head)) return;
      const group = above.replace(/\s+/g, " ").trim();
      const brand = head.replace(/\d+$/, "").trim();
      assetCols.push({ col: c, group, brand: norm(brand) === norm(group) || !brand ? "" : brand });
    });

    const stores: ParsedVisibilityStore[] = [];
    for (let i = r + 1; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const get = (c?: number) => (c ? text(row.getCell(c).value).trim() : "");
      const ch = get(channel);
      const name = get(store);
      const person = get(tm);
      if (!ch || !name || !person) continue;
      const m = CHANNEL[norm(ch)] ?? { market: marketCode(ch) ?? ch.toUpperCase(), area: ch };
      const cityName = get(city).replace(/\s+/g, " ") || null;
      const area = m.market === "AUH" && /ain/i.test(cityName ?? "") ? "Al Ain" : m.area;
      const visibility: Record<string, Record<string, number>> = {};
      for (const a of assetCols) {
        const raw = get(a.col);
        const q = /^yes$/i.test(raw) ? 1 : Number(raw);
        if (!raw || !Number.isFinite(q) || q <= 0) continue;
        (visibility[a.group] ??= {})[a.brand || "In place"] = ((visibility[a.group] ?? {})[a.brand || "In place"] ?? 0) + q;
      }
      const storeType = get(type) || null;
      const key = matchKey(ch, get(customer), name, storeType ?? "");
      stores.push({
        code: get(code) || `TBC-${hash(key)}`,
        name,
        chain: get(customer) || null,
        market: m.market,
        area,
        tmam: person,
        segment: get(seg) ? segment(/^ir$/i.test(get(seg)) ? "Industrial Retail" : get(seg)) : null,
        // Influenced = something of ours is in the store (matches the TM structure deck).
        influenced: Object.keys(visibility).length > 0,
        visit_frequency: null,
        target_year: null,
        city: cityName,
        store_type: storeType,
        visibility,
        visibility_flag: get(flag) || null,
        match_key: key,
        ...(opened ? { opened_year: openedYear(get(opened)) } : {}),
      });
    }
    return { stores, groups: [...new Set(assetCols.map((a) => a.group))], hasOpened: !!opened };
  }
  return null;
}

/** Short, stable id from text (FNV-1a), for stores waiting for their real code. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

/** The Visibility Master File tab, if the workbook has one. */
export async function findVisibilityMaster(buffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheets = [...wb.worksheets].sort((a, b) => Number(/visibility\s*master/i.test(b.name)) - Number(/visibility\s*master/i.test(a.name)));
  for (const ws of sheets) {
    const parsed = parseVisibilityMaster(ws);
    if (parsed?.stores.length) return { sheet: ws.name.trim(), ...parsed };
  }
  return null;
}

/** History template: one row per thing installed. Store code, or store name (+ chain) until codes exist. */
export async function buildHistoryTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Installed");
  ws.columns = ["Store code", "Store name", "Chain", "Type", "Item", "Brand", "Quantity", "Completed date", "Actual cost", "Notes"].map((h) => ({ header: h, width: 18 }));
  ws.addRow(["", "MMI Al Wasl", "MMI", "Branding", "Wall branding", "Heineken", 1, "2025-09-15", 8000, ""]);
  ws.addRow(["", "MMI Al Wasl", "MMI", "Perfect shelf", "Cold units", "Birra Moretti", 1, "2026-02-10", 4500, ""]);
  ws.addRow(["", "Spinneys - The Galleria", "Spinneys", "Fridge", "Fridge", "Heineken", 2, "2026-05-01", 12000, "Two door"]);
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF58A244" } };
  return wb.xlsx.writeBuffer();
}

// ---------------------------------------------------------------------------
// Retail KPI tracker (e.g. "2025 Retail KPIs": ABU DHABI, NER and DXBR tabs)
// ---------------------------------------------------------------------------

/**
 * One row per asset: Market · What · Brand · Where · # · Customer · Store · …, then Q1–Q4 with "Y" in
 * the quarter it was done ("N" = cancelled, "_" = not yet) and a 2026 column for carry-overs. Rows
 * done in a quarter become completed projects dated at the end of that quarter.
 */
export type KpiRow = ParsedProject & { market: string | null; sheet: string };

const KPI_TABS = /^(abu\s*dhabi|adr|auh|ner|ne|dxbr|dxb\s*r(etail)?|dxb\s*ir|al\s*ain|oman|bahrain|qatar)$/i;
const TAB_MARKET: [RegExp, string][] = [
  [/omanr?/i, "OM"],
  [/abu|adr|auh|ain/i, "AUH"],
  [/ner|^ne$/i, "NE"],
  [/dxb/i, "DXB"],
  [/oman/i, "OM"],
  [/bahrain/i, "BH"],
  [/qatar/i, "QA"],
];
const QUARTER_END = ["03-31", "06-30", "09-30", "12-31"];
const QUARTER_START = ["01-01", "04-01", "07-01", "10-01"];

/** What → project type and item. "Branded Unit" is the perfect-shelf KPI (its targets match). */
export function kpiType(what: string): { type: string; item: string } | null {
  const w = what.replace(/\s+/g, " ").trim();
  const n = norm(w);
  if (!n || /^units?$|ofunits/.test(n)) return null;
  if (n === "other" || n === "others") return { type: "Other", item: "Other" };
  if (/fulloutletbranding|fullbarbranding|takeover/.test(n)) return { type: "Takeover", item: w };
  if (/brandedunit|perfectshel|blade/.test(n)) return { type: "Perfect shelf", item: w };
  if (/coldroom|coolerroom/.test(n)) return { type: "Cold room", item: w };
  if (/^fridges?$/.test(n)) return { type: "Fridge", item: "Fridge" };
  if (/^fsus?$/.test(n)) return { type: "FSU", item: "FSU" };
  if (/fridge/.test(n)) return { type: "Fridge", item: w };
  return { type: "Branding", item: w };
}

/**
 * Two layouts are read:
 *  - 2025: one tab per market (ABU DHABI, NER, DXBR) with What · Brand · # · Customer · Store and
 *    Q1–Q4 holding "Y" when done.
 *  - 2026: a combined tab ("ADR NER DXB OMAN DDF") with Channel · Customer · Store · Visibility ·
 *    Brand · Q1–Q4 · TM · Cost Estimate · Actual Cost. When a combined tab is there, single-market
 *    tabs (older working copies) are ignored.
 * Quarter codes: Y = done, 1 = locked in, 0 = planned, N = cancelled, _ = nothing. Done rows become
 * completed projects (end of that quarter); for the current or a future year, locked-in and planned
 * rows become in-progress / planned projects (start of that quarter), so they show as targets.
 */
export function parseKpiTracker(wb: ExcelJS.Workbook, year: number): { rows: KpiRow[]; tabs: string[]; skipped: number } | null {
  const sheets: { name: string; rows: KpiRow[]; skipped: number; channels: Set<string> }[] = [];
  const thisYear = new Date().getFullYear();
  for (const ws of wb.worksheets) {
    let hr = 0;
    const col = new Map<string, number>();
    for (let r = 1; r <= Math.min(10, ws.rowCount) && !hr; r++) {
      const heads = new Map<string, number>();
      ws.getRow(r).eachCell((cell, c) => {
        const h = norm(text(cell.value));
        if (h && !heads.has(h)) heads.set(h, c);
      });
      if (heads.has("store") && heads.has("q1") && (heads.has("what") || heads.has("visibility") || heads.has("newvisibility"))) {
        hr = r;
        for (const [k, v] of heads) col.set(k, v);
      }
    }
    if (!hr || (!KPI_TABS.test(ws.name.trim()) && !col.has("channel"))) continue;
    const whatKey = col.has("what") ? "what" : col.has("visibility") ? "visibility" : "newvisibility";
    const tabMarket = TAB_MARKET.find(([re]) => re.test(ws.name))?.[1] ?? null;
    const get = (row: ExcelJS.Row, k: string) => (col.has(k) ? text(row.getCell(col.get(k)!).value).trim() : "");
    const sheet = { name: ws.name.trim(), rows: [] as KpiRow[], skipped: 0, channels: new Set<string>() };
    for (let i = hr + 1; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const store = get(row, "store");
      const what = get(row, whatKey);
      if (!store || !what) continue;
      const channel = get(row, "channel");
      let market = tabMarket;
      if (col.has("channel")) {
        if (!channel || /summary|channel|total/i.test(channel)) continue;
        if (/ddf|duty\s*free/i.test(channel)) {
          sheet.skipped++;
          continue;
        }
        sheet.channels.add(channel.toUpperCase());
        market = TAB_MARKET.find(([re]) => re.test(channel))?.[1] ?? null;
      }
      const qs = ["q1", "q2", "q3", "q4"].map((k) => get(row, k).toUpperCase());
      const done = qs.findIndex((x) => x.startsWith("Y"));
      const locked = qs.findIndex((x) => x === "1");
      const planned = qs.findIndex((x) => x === "0");
      const t = kpiType(what);
      const live = year >= thisYear;
      const status = done >= 0 ? "completed" : live && locked >= 0 ? "in_progress" : live && planned >= 0 ? "planned" : null;
      if (!t || !status) {
        sheet.skipped++;
        continue;
      }
      const q = done >= 0 ? done : locked >= 0 ? locked : planned;
      const qty = Number(get(row, "#") || "1");
      const money = (k: string) => {
        const n = Number(get(row, k).replace(/[^0-9.]/g, ""));
        return n > 0 ? Math.round(n * 100) / 100 : null;
      };
      sheet.rows.push({
        code: get(row, "storecode") || get(row, "code"),
        name: store,
        chain: get(row, "customer") || get(row, "customername") || null,
        type: t.type,
        item: t.item,
        brand: get(row, "brand") || null,
        quantity: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1,
        status,
        plan_year: year,
        // 2025 only marks what was done; from 2026 a done row was also planned for that quarter.
        planned_date: col.has("channel") ? `${year}-${QUARTER_START[q]}` : status === "completed" ? null : `${year}-${QUARTER_START[q]}`,
        completed_date: status === "completed" ? `${year}-${QUARTER_END[q]}` : null,
        expected_cost_aed: money("costestimateaed"),
        actual_cost_aed: status === "completed" ? money("actualcostaed") : null,
        notes: [get(row, "remarks"), get(row, "comment"), get(row, "notes")].filter(Boolean).join(" · ") || null,
        market,
        sheet: ws.name.trim(),
      });
    }
    sheets.push(sheet);
  }
  // A combined tab (several channels) is the master; single-market tabs beside it are working copies.
  const master = sheets.reduce<(typeof sheets)[number] | null>((m, x) => (x.channels.size >= 2 && x.channels.size > (m?.channels.size ?? 0) ? x : m), null);
  const use = master ? [master] : sheets;
  if (!use.length) return null;
  return { rows: use.flatMap((x) => x.rows), tabs: use.map((x) => x.name), skipped: use.reduce((n, x) => n + x.skipped, 0) };
}

/** The year a KPI file is for: from its name ("2025 Retail KPIs"), else last year. */
export const kpiYear = (filename: string) => Number(filename.match(/20\d\d/)?.[0]) || new Date().getFullYear() - 1;

export async function loadWorkbook(buffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}
