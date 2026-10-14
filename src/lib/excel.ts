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

// Only these come from the workbook. Max per order, multiples, ETA, visibility
// and markets are set by admins in the system and never overwritten by an upload.
const ITEM_FIELDS: Field<"sku" | "brand" | "name" | "category" | "value" | "stock">[] = [
  { key: "sku", required: true, aliases: ["sku code", "sku", "item code", "material code", "material", "code", "article code", "article"] },
  { key: "name", required: true, aliases: ["item name", "posm item", "posm name", "item", "name", "item description", "description", "posm"] },
  { key: "brand", aliases: ["brand name", "brand"] },
  { key: "category", aliases: ["category", "item category", "posm category", "type", "item type", "posm type"] },
  { key: "value", aliases: ["total cost per unit", "cost per unit", "value", "unit value", "value aed", "unit cost", "unit cost aed", "cost", "cost aed", "unit price", "price"] },
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
  sheets: { name: string; kind: "items" | "accounts" | "skipped"; rows: number; columns: Record<string, string> }[];
  warnings: string[];
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

  const result: ParseResult = { items: [], accounts: [], sheets: [], warnings: [] };
  const seenSku = new Map<string, number>();
  const seenAccount = new Map<string, number>();

  // The budgeting workbook has several tabs with SKU columns (EXTRAS, DELISTED,
  // HAL ORDERS…). When the named tabs exist, only they are read.
  const names = wb.worksheets.map((w) => w.name);
  const itemTabs = names.filter((n) => /current\s*stock/i.test(n));
  const accountTabs = names.filter((n) => /customer\s*list/i.test(n));

  wb.eachSheet((sheet) => {
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
