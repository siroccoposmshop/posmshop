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

const ITEM_FIELDS: Field<"sku" | "brand" | "name" | "category" | "value" | "stock" | "max_per_order" | "order_multiple" | "markets">[] = [
  { key: "sku", required: true, aliases: ["sku code", "sku", "item code", "material code", "material", "code", "article code", "article"] },
  { key: "name", required: true, aliases: ["item name", "posm item", "posm name", "item", "name", "item description", "description", "posm"] },
  { key: "brand", aliases: ["brand name", "brand"] },
  { key: "category", aliases: ["category", "item category", "posm category", "type", "item type", "posm type"] },
  { key: "value", aliases: ["value", "unit value", "value aed", "unit cost", "unit cost aed", "cost", "cost aed", "unit price", "price"] },
  { key: "stock", aliases: ["current stock level", "current stock", "stock level", "stock", "stock on hand", "soh", "available stock", "available", "qty available", "quantity"] },
  { key: "max_per_order", aliases: ["max per order", "limit per order", "order limit", "max qty", "max order qty", "limit"] },
  { key: "order_multiple", aliases: ["order multiple", "multiple", "multiples", "pack size", "case size", "moq"] },
  { key: "markets", aliases: ["markets", "market", "visible markets", "country"] },
];

const ACCOUNT_FIELDS: Field<"account_number" | "name" | "market" | "channel">[] = [
  { key: "account_number", required: true, aliases: ["account number", "account no", "account", "customer number", "customer no", "customer code", "account code", "acc no", "sold to", "ship to", "outlet code"] },
  { key: "name", required: true, aliases: ["account name", "customer name", "outlet name", "outlet", "customer", "name"] },
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
  max_per_order?: number | null;
  order_multiple?: number;
  markets?: string[];
};

export type ParsedAccount = {
  account_number: string;
  name: string;
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
  uae: "UAE", ae: "UAE", "united arab emirates": "UAE", dubai: "UAE", "abu dhabi": "UAE", sharjah: "UAE", "northern emirates": "UAE",
  oman: "OMN", om: "OMN", omn: "OMN", muscat: "OMN",
  qatar: "QAT", qa: "QAT", qat: "QAT", doha: "QAT",
  bahrain: "BHR", bh: "BHR", bhr: "BHR", manama: "BHR",
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

  wb.eachSheet((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const values = row.values as ExcelJS.CellValue[];
      rows.push(values.slice(1).map(cellText));
    });

    // Find the header row within the first 20 rows.
    let detected: { kind: "items" | "accounts"; headerIdx: number; map: Record<string, number> } | null = null;
    for (let r = 0; r < Math.min(rows.length, 20) && !detected; r++) {
      const items = matchColumns(rows[r], ITEM_FIELDS);
      if (items.ok) {
        detected = { kind: "items", headerIdx: r, map: items.map };
        break;
      }
      const accounts = matchColumns(rows[r], ACCOUNT_FIELDS);
      if (accounts.ok) detected = { kind: "accounts", headerIdx: r, map: accounts.map };
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
        if (detected.map.max_per_order !== undefined) {
          const n = toNumber(get(row, "max_per_order"));
          item.max_per_order = n && n > 0 ? Math.floor(n) : null;
        }
        if (detected.map.order_multiple !== undefined) {
          const n = toNumber(get(row, "order_multiple"));
          item.order_multiple = n && n >= 1 ? Math.floor(n) : 1;
        }
        if (detected.map.markets !== undefined) {
          const raw = get(row, "markets");
          const markets = raw
            .split(/[,;/|]+/)
            .map((m) => (/^all$/i.test(m.trim()) ? "ALL" : normaliseMarket(m)))
            .filter((m): m is string => !!m);
          if (markets.includes("ALL")) item.markets = ["UAE", "OMN", "QAT", "BHR"];
          else if (markets.length) item.markets = [...new Set(markets)];
        }
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
        const account: ParsedAccount = { account_number, name, market, channel: get(row, "channel") || null };
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
  const items = wb.addWorksheet("Items");
  items.columns = [
    { header: "Brand", key: "brand", width: 16 },
    { header: "Item name", key: "name", width: 36 },
    { header: "SKU code", key: "sku", width: 16 },
    { header: "Category", key: "category", width: 16 },
    { header: "Value", key: "value", width: 10 },
    { header: "Current stock", key: "stock", width: 14 },
    { header: "Max per order", key: "max", width: 14 },
    { header: "Order multiple", key: "multiple", width: 14 },
    { header: "Markets", key: "markets", width: 20 },
  ];
  items.addRow({ brand: "Heineken", name: "Heineken 25cl glass", sku: "HNK-GL-25", category: "Glassware", value: 4.5, stock: 1200, max: 48, multiple: 6, markets: "UAE, Oman" });
  items.addRow({ brand: "Amstel", name: "Amstel coaster", sku: "AMS-CO-01", category: "Coasters", value: 0.2, stock: 20000, max: 500, multiple: 1, markets: "All" });

  const accounts = wb.addWorksheet("Accounts");
  accounts.columns = [
    { header: "Account number", key: "num", width: 16 },
    { header: "Account name", key: "name", width: 36 },
    { header: "Market", key: "market", width: 12 },
    { header: "Channel", key: "channel", width: 16 },
  ];
  accounts.addRow({ num: "100234", name: "Example Hotel Bar", market: "UAE", channel: "On-trade" });

  for (const ws of [items, accounts]) {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF58A244" } };
  }
  return wb.xlsx.writeBuffer();
}
