import "server-only";
import ExcelJS from "exceljs";

/**
 * Reads the "2026 POSM Budgeting" workbook.
 *
 * The exact layout of the file isn't fixed, so every sheet is scanned for a
 * header row and columns are matched by name (see the alias lists below).
 * Sheets that look like item lists and sheets that look like account lists
 * are both picked up; a single sheet can't be both.
 */

type Field<K extends string> = { key: K; aliases: string[]; required?: boolean };

// Only these come from the workbook (plus ETAs from the ORDERS tab, see parseOrders).
// Max per order, multiples, visibility and markets are set by admins and never overwritten.
const ITEM_FIELDS: Field<"sku" | "brand" | "name" | "category" | "value" | "stock" | "months_of_stock" | "notes">[] = [
  { key: "sku", required: true, aliases: ["sku code", "sku", "item code", "material code", "material", "code", "article code", "article"] },
  { key: "name", required: true, aliases: ["item name", "posm item", "posm name", "item", "name", "item description", "description", "posm"] },
  { key: "brand", aliases: ["brand name", "brand"] },
  { key: "category", aliases: ["category", "item category", "posm category", "type", "item type", "posm type"] },
  { key: "value", aliases: ["total cost per unit", "cost per unit", "value", "unit value", "value aed", "unit cost", "unit cost aed", "cost", "cost aed", "unit price", "price"] },
  { key: "notes", aliases: ["notes", "note", "comments"] },
  { key: "months_of_stock", aliases: ["months of stock", "months stock", "stock cover months", "months cover"] },
  { key: "stock", aliases: ["current stock level", "current stock", "stock level", "stock", "stock on hand", "soh", "available stock", "available", "qty available", "quantity"] },
];

const ACCOUNT_FIELDS: Field<"account_number" | "name" | "parent_name" | "kam_name" | "market" | "channel">[] = [
  { key: "account_number", required: true, aliases: ["account number", "account no", "account", "customer number", "customer no", "customer code", "account code", "acc no", "sold to", "ship to", "outlet code"] },
  { key: "name", required: true, aliases: ["account name", "customer name", "outlet name", "outlet", "customer", "name"] },
  { key: "parent_name", aliases: ["parent account account name", "parent account name", "parent account", "parent name", "parent"] },
  { key: "kam_name", aliases: ["parent sirocco kam", "sirocco kam", "kam name", "kam"] },
  { key: "market", aliases: ["market", "country", "region"] },
  { key: "channel", aliases: ["channel", "trade channel", "segment", "sub channel"] },
];

export type ParsedItem = {
  sku: string;
  name: string;
  brand: string;
  category: string | null;
  value: number | null;
  stock: number | null;
  months_of_stock: number | null;
  /** "Delist" in the Notes column. */
  delisted: boolean;
};

export type ParsedAccount = {
  account_number: string;
  name: string;
  /** First 5 digits of the account number — identifies the parent account. */
  parent_number: string;
  parent_name: string;
  kam_name: string | null;
  market: string | null;
  channel: string | null;
};

export type ParseResult = {
  items: ParsedItem[];
  accounts: ParsedAccount[];
  sheets: { name: string; kind: "items" | "accounts" | "orders" | "extras" | "skipped"; rows: number; columns: Record<string, string> }[];
  warnings: string[];
  /** Soonest ETA (yyyy-mm-dd) per item code on an open order in the ORDERS tab, as written there. */
  orderEtas: Map<string, string>;
  /** Stock figures from the EXTRAS tab; only used to update items that already exist. */
  extras: { sku: string; stock: number | null; months_of_stock: number | null }[];
};

const MARKET_ALIASES: Record<string, string> = {
  dubai: "DXB", dxb: "DXB",
  "abu dhabi": "AUH", auh: "AUH", "al ain": "AUH",
  "northern emirates": "NE", ne: "NE", sharjah: "NE", ajman: "NE", "ras al khaimah": "NE", rak: "NE",
  fujairah: "NE", "umm al quwain": "NE", uaq: "NE",
};

export function normaliseMarket(value: string | null | undefined): string | null {
  if (!value) return null;
  return MARKET_ALIASES[value.trim().toLowerCase()] ?? null;
}

function normaliseHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, (m) => ` ${m.slice(1, -1)} `)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) {
      // ExcelJS drops a formula's cached result when it is 0, so a missing result means 0.
      const result = (value as { result?: ExcelJS.CellValue }).result;
      return result === undefined ? "0" : cellText(result);
    }
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value) return String(value.text);
    if ("error" in value) return "";
    return "";
  }
  return String(value).trim();
}

function toNumber(text: string): number | null {
  if (!text) return null;
  const n = Number(text.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function matchColumns<K extends string>(headerRow: string[], fields: Field<K>[]) {
  const normalised = headerRow.map(normaliseHeader);
  const used = new Set<number>();
  const map = {} as Record<K, number>;
  for (const field of fields) {
    for (const alias of field.aliases) {
      const idx = normalised.findIndex((h, i) => !used.has(i) && h === alias);
      if (idx >= 0) {
        map[field.key] = idx;
        used.add(idx);
        break;
      }
    }
  }
  const ok = fields.filter((f) => f.required).every((f) => map[f.key] !== undefined);
  return { map, ok };
}

export async function parseWorkbook(buffer: ArrayBuffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const result: ParseResult = { items: [], accounts: [], sheets: [], warnings: [], orderEtas: new Map(), extras: [] };
  const seenSku = new Map<string, number>();
  const seenAccount = new Map<string, number>();

  // The budgeting workbook has several tabs with SKU columns (EXTRAS, DELISTED,
  // HAL ORDERS…). When the named tabs exist, only they are read.
  const names = wb.worksheets.map((w) => w.name);
  const itemTabs = names.filter((n) => /current\s*stock/i.test(n));
  const accountTabs = names.filter((n) => /customer\s*list/i.test(n));

  wb.eachSheet((sheet) => {
    if (/^\s*orders\s*$/i.test(sheet.name)) {
      const orders = parseOrders(sheet);
      result.orderEtas = orders.etas;
      result.sheets.push({ name: sheet.name, kind: orders.ok ? "orders" : "skipped", rows: orders.rows, columns: orders.columns });
      return;
    }
    if (/^\s*extras\s*$/i.test(sheet.name)) {
      result.extras = parseExtras(sheet);
      result.sheets.push({ name: sheet.name, kind: result.extras.length ? "extras" : "skipped", rows: result.extras.length, columns: {} });
      return;
    }
    const onlyItems = itemTabs.includes(sheet.name);
    const onlyAccounts = accountTabs.includes(sheet.name);
    if ((itemTabs.length || accountTabs.length) && !onlyItems && !onlyAccounts) {
      result.sheets.push({ name: sheet.name, kind: "skipped", rows: 0, columns: {} });
      return;
    }
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const values = row.values as ExcelJS.CellValue[];
      rows.push(values.slice(1).map(cellText));
    });

    // Find the header row within the first 20 rows.
    let detected: { kind: "items" | "accounts"; headerIdx: number; map: Record<string, number> } | null = null;
    for (let r = 0; r < Math.min(rows.length, 20) && !detected; r++) {
      const items = matchColumns(rows[r], ITEM_FIELDS);
      if (items.ok && !onlyAccounts) {
        detected = { kind: "items", headerIdx: r, map: items.map };
        break;
      }
      const accounts = matchColumns(rows[r], ACCOUNT_FIELDS);
      if (accounts.ok && !onlyItems) detected = { kind: "accounts", headerIdx: r, map: accounts.map };
    }

    if (!detected) {
      result.sheets.push({ name: sheet.name, kind: "skipped", rows: 0, columns: {} });
      return;
    }

    const header = rows[detected.headerIdx];
    const columns = Object.fromEntries(Object.entries(detected.map).map(([k, i]) => [k, header[i]]));
    const get = (row: string[], key: string) => (detected.map[key] !== undefined ? (row[detected.map[key]] ?? "").trim() : "");
    let count = 0;

    for (const row of rows.slice(detected.headerIdx + 1)) {
      if (detected.kind === "items") {
        const sku = get(row, "sku");
        const name = get(row, "name");
        if (!sku || !name) continue;
        const item: ParsedItem = {
          sku,
          name,
          brand: get(row, "brand") || "Other",
          category: get(row, "category") || null,
          value: toNumber(get(row, "value")),
          stock: toNumber(get(row, "stock")),
          months_of_stock: toNumber(get(row, "months_of_stock")),
          delisted: /delist/i.test(get(row, "notes")),
        };
        const existing = seenSku.get(sku);
        if (existing !== undefined) {
          result.warnings.push(`SKU ${sku} appears more than once — the last row (sheet "${sheet.name}") was used.`);
          result.items[existing] = item;
        } else {
          seenSku.set(sku, result.items.length);
          result.items.push(item);
        }
      } else {
        const account_number = get(row, "account_number");
        const name = get(row, "name");
        if (!account_number || !name) continue;
        const marketRaw = get(row, "market");
        const market = normaliseMarket(marketRaw);
        if (marketRaw && !market) result.warnings.push(`Account ${account_number}: unknown market "${marketRaw}".`);
        const parent_number = account_number.match(/^\d{5}/)?.[0] ?? account_number.match(/^\d+/)?.[0] ?? account_number;
        if (!/^\d{5}/.test(account_number)) {
          result.warnings.push(`Account ${account_number} doesn't start with 5 digits — used "${parent_number}" as the parent number.`);
        }
        const account: ParsedAccount = {
          account_number,
          name,
          parent_number,
          parent_name: get(row, "parent_name") || name,
          kam_name: get(row, "kam_name") || null,
          market,
          channel: get(row, "channel") || null,
        };
        const existing = seenAccount.get(account_number);
        if (existing !== undefined) result.accounts[existing] = account;
        else {
          seenAccount.set(account_number, result.accounts.length);
          result.accounts.push(account);
        }
      }
      count++;
    }
    result.sheets.push({ name: sheet.name, kind: detected.kind, rows: count, columns });
  });

  if (!result.items.length && !result.accounts.length) {
    result.warnings.push(
      "No item or account columns were recognised. Items need at least an SKU column and an item name column; accounts need an account number and an account name.",
    );
  }
  return result;
}

/** EXTRAS tab: same columns as CURRENT STOCK (SKU in "CODE"). Only the stock figures are used. */
function parseExtras(sheet: ExcelJS.Worksheet) {
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => rows.push((row.values as ExcelJS.CellValue[]).slice(1).map(cellText)));
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const { map, ok } = matchColumns(rows[r], ITEM_FIELDS);
    if (!ok) continue;
    const get = (row: string[], key: keyof typeof map) => (map[key] !== undefined ? (row[map[key]] ?? "").trim() : "");
    return rows.slice(r + 1).flatMap((row) => {
      const sku = get(row, "sku");
      return sku ? [{ sku, stock: toNumber(get(row, "stock")), months_of_stock: toNumber(get(row, "months_of_stock")) }] : [];
    });
  }
  return [];
}

/** Days added to an ORDERS-tab ETA (arrival at port) to allow for clearing and delivery to the warehouse. */
export const ETA_BUFFER_DAYS = 14;

/**
 * ORDERS tab: purchase orders with an "Item Codes" list and an "ETA" date.
 * Delivered orders and ETAs that aren't dates (CANCELLED, "END NOV"…) are ignored;
 * when a code is on several open orders the soonest ETA wins. ETA_BUFFER_DAYS is added to each.
 */
function parseOrders(sheet: ExcelJS.Worksheet) {
  const etas = new Map<string, string>();
  const rows: ExcelJS.CellValue[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => rows.push((row.values as ExcelJS.CellValue[]).slice(1)));

  const headerIdx = rows.slice(0, 20).findIndex((r) => {
    const h = r.map((c) => normaliseHeader(cellText(c)));
    return h.includes("eta") && h.some((x) => x === "item codes" || x === "item code");
  });
  if (headerIdx < 0) return { ok: false, etas, rows: 0, columns: {} };
  const header = rows[headerIdx].map((c) => normaliseHeader(cellText(c)));
  const col = {
    codes: header.findIndex((x) => x === "item codes" || x === "item code"),
    eta: header.indexOf("eta"),
    delivered: header.indexOf("delivered"),
  };

  let count = 0;
  for (const row of rows.slice(headerIdx + 1)) {
    if (col.delivered >= 0 && /^y/i.test(cellText(row[col.delivered]))) continue;
    const sheetEta = toIsoDate(row[col.eta]);
    if (!sheetEta) continue;
    const eta = addDays(sheetEta, ETA_BUFFER_DAYS);
    const codes = splitItemCodes(cellText(row[col.codes]));
    if (!codes.length) continue;
    count++;
    for (const code of codes) {
      const current = etas.get(code);
      if (!current || eta < current) etas.set(code, eta);
    }
  }
  const raw = rows[headerIdx].map((c) => cellText(c));
  const columns: Record<string, string> = { codes: raw[col.codes], eta: raw[col.eta] };
  if (col.delivered >= 0) columns.delivered = raw[col.delivered];
  return { ok: true, etas, rows: count, columns };
}

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toIsoDate(value: ExcelJS.CellValue): string | null {
  if (value && typeof value === "object" && !(value instanceof Date) && "result" in value) {
    return toIsoDate(value.result as ExcelJS.CellValue);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // A date stored as a plain Excel serial number.
  if (typeof value === "number" && value > 40000 && value < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
  }
  const text = cellText(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

/** "PAUL17, 40, 19" → PAUL17, PAUL40, PAUL19 · "INCH001 / INCH002" · "HKN169 (27K)" → HKN169 */
export function splitItemCodes(text: string): string[] {
  const codes: string[] = [];
  let prefix = "";
  for (const token of text.toUpperCase().replace(/\(.*?\)/g, " ").split(/[^A-Z0-9]+/)) {
    const m = token.match(/^([A-Z]+)\d+$/);
    if (m) {
      prefix = m[1];
      codes.push(token);
    } else if (/^\d+$/.test(token) && prefix) {
      codes.push(prefix + token);
    }
  }
  return codes;
}

/**
 * Matches ORDERS-tab codes to item SKUs: exactly, or ignoring leading zeros in the number
 * (BRD026 → BRD26) when that can only mean one item. Returns SKU → ETA plus unmatched codes.
 */
export function matchOrderEtas(etas: Map<string, string>, skus: string[]) {
  const exact = new Map(skus.map((s) => [s.toUpperCase(), s]));
  const loose = new Map<string, string | null>();
  const looseKey = (s: string) => s.toUpperCase().replace(/^([A-Z]+)0*(\d+)$/, "$1$2");
  for (const s of skus) loose.set(looseKey(s), loose.has(looseKey(s)) ? null : s);

  const bySku = new Map<string, string>();
  const unmatched: string[] = [];
  for (const [code, eta] of etas) {
    const sku = exact.get(code) ?? loose.get(looseKey(code)) ?? null;
    if (!sku) {
      unmatched.push(code);
      continue;
    }
    const current = bySku.get(sku);
    if (!current || eta < current) bySku.set(sku, eta);
  }
  return { bySku, unmatched };
}

export async function buildTemplate() {
  const wb = new ExcelJS.Workbook();
  const items = wb.addWorksheet("CURRENT STOCK");
  items.columns = [
    { header: "Brand", key: "brand", width: 16 },
    { header: "Item", key: "name", width: 36 },
    { header: "SKU Code", key: "sku", width: 14 },
    { header: "Category", key: "category", width: 16 },
    { header: "Current Stock", key: "stock", width: 14 },
    { header: "TOTAL Cost per Unit ($)", key: "value", width: 22 },
  ];
  items.addRow({ brand: "Amstel", name: "AMSTEL PINT GLASS", sku: "AMS33", category: "Glassware", stock: 15399, value: 3.75 });

  const accounts = wb.addWorksheet("CUSTOMER LIST");
  accounts.columns = [
    { header: "MARKET", key: "market", width: 12 },
    { header: "Account Number", key: "num", width: 16 },
    { header: "Account Name", key: "name", width: 30 },
    { header: "Parent Account: Account Name", key: "parent", width: 44 },
    { header: "Parent Sirocco KAM", key: "kam", width: 22 },
  ];
  accounts.addRow({ market: "DUBAI", num: "53248-SF-3", name: "ERNST", parent: "25 HOURS HOTEL DUBAI ONE CENTRAL LLC - Ennismore", kam: "Manish Punjabi" });

  for (const ws of [items, accounts]) {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF58A244" } };
  }
  return wb.xlsx.writeBuffer();
}
