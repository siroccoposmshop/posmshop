import "server-only";
import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";
import { CS_ORDER_TEMPLATE_BASE64 } from "@/lib/templates/cs-order-template";
import type { Order, OrderItem } from "@/lib/types";

/**
 * The order file for Customer Service, filled into their Excel template. Every position is a
 * rule, editable in Admin → POSM Shop → Order sheet, as is the template.
 */
export type OrderSheetRules = {
  /** First row of the item lines; the template's lines from here down are replaced. */
  firstItemRow: number;
  codeCol: string;
  nameCol: string;
  qtyCol: string;
  caseFactorCol: string;
  /** Always the item's primary unit of measure. */
  caseFactorValue: string;
  unitPriceCol: string;
  unitPriceValue: number;
  /** Line total (quantity × unit price); blank = leave empty. */
  totalCol: string;
  accountNameCell: string;
  customerCodeCell: string;
  orderNumberCell: string;
  /** {account} = the account number, {company} = the market's company code (e.g. M10). */
  customerCodeFormat: string;
  /** Whose number and name go in: the outlet ordered for, or its parent account. */
  accountLevel: "outlet" | "parent";
};

export const DEFAULT_ORDER_SHEET_RULES: OrderSheetRules = {
  firstItemRow: 7,
  codeCol: "A",
  nameCol: "C",
  qtyCol: "D",
  caseFactorCol: "E",
  caseFactorValue: "Each",
  unitPriceCol: "G",
  unitPriceValue: 0,
  totalCol: "H",
  accountNameCell: "F2",
  customerCodeCell: "G2",
  orderNumberCell: "F3",
  customerCodeFormat: "{account}_{company}",
  accountLevel: "outlet",
};

export const isCol = (v: string) => /^[A-Z]{1,3}$/.test(v);
export const isCell = (v: string) => /^[A-Z]{1,3}[1-9]\d{0,5}$/.test(v);

/** Rules as saved, with any missing or invalid value falling back to the default. */
export function cleanRules(raw: Partial<Record<keyof OrderSheetRules, unknown>> | null | undefined): OrderSheetRules {
  const r = { ...DEFAULT_ORDER_SHEET_RULES };
  const d = DEFAULT_ORDER_SHEET_RULES;
  const s = (k: keyof OrderSheetRules) => String(raw?.[k] ?? "").trim();
  const col = (k: keyof OrderSheetRules, allowBlank = false) => {
    const v = s(k).toUpperCase();
    return isCol(v) || (allowBlank && v === "") ? v : (d[k] as string);
  };
  const cell = (k: keyof OrderSheetRules) => {
    const v = s(k).toUpperCase();
    return isCell(v) ? v : (d[k] as string);
  };
  const row = Math.round(Number(raw?.firstItemRow));
  r.firstItemRow = row >= 1 && row <= 1000 ? row : d.firstItemRow;
  r.codeCol = col("codeCol");
  r.nameCol = col("nameCol");
  r.qtyCol = col("qtyCol");
  r.caseFactorCol = col("caseFactorCol", true);
  r.caseFactorValue = s("caseFactorValue") || d.caseFactorValue;
  r.unitPriceCol = col("unitPriceCol", true);
  r.unitPriceValue = Number.isFinite(Number(raw?.unitPriceValue)) && s("unitPriceValue") !== "" ? Number(raw?.unitPriceValue) : d.unitPriceValue;
  r.totalCol = col("totalCol", true);
  r.accountNameCell = cell("accountNameCell");
  r.customerCodeCell = cell("customerCodeCell");
  r.orderNumberCell = cell("orderNumberCell");
  r.customerCodeFormat = s("customerCodeFormat") || d.customerCodeFormat;
  r.accountLevel = s("accountLevel") === "parent" ? "parent" : "outlet";
  return r;
}

export type OrderSheetSettings = { rules: OrderSheetRules; template: Buffer; templateName: string | null; custom: boolean; updatedAt: string | null };

export async function loadOrderSheetSettings(): Promise<OrderSheetSettings> {
  const { data } = await createAdminClient().from("order_sheet_settings").select("*").eq("id", 1).maybeSingle();
  const custom = !!data?.template_b64;
  return {
    rules: cleanRules(data?.rules as Record<string, unknown> | undefined),
    template: Buffer.from(custom ? (data!.template_b64 as string) : CS_ORDER_TEMPLATE_BASE64, "base64"),
    templateName: custom ? ((data!.template_name as string) ?? "Uploaded template") : null,
    custom,
    updatedAt: (data?.updated_at as string) ?? null,
  };
}

/** The customer code: the account number with the market's company code, as the rule says. */
export function customerCode(rules: OrderSheetRules, accountNumber: string, companyCode: string | null) {
  if (/_[A-Z]\d+$/i.test(accountNumber)) return accountNumber; // already carries its company code
  return rules.customerCodeFormat.replace(/\{account\}/g, accountNumber).replace(/\{company\}/g, companyCode ?? "").replace(/_$/, "");
}

type SheetOrder = Pick<Order, "order_number" | "account_number" | "account_name" | "parent_number" | "parent_name">;
type SheetItem = Pick<OrderItem, "sku" | "name" | "qty">;

export async function buildOrderSheet(order: SheetOrder, items: SheetItem[], companyCode: string | null, settings?: OrderSheetSettings): Promise<Buffer> {
  const { rules, template } = settings ?? (await loadOrderSheetSettings());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(template as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("The order template has no sheet");

  const parent = rules.accountLevel === "parent";
  const number = (parent ? order.parent_number : null) ?? order.account_number;
  const name = (parent ? order.parent_name : null) ?? order.account_name;
  const code = customerCode(rules, number, companyCode);
  ws.getCell(rules.accountNameCell).value = name;
  ws.getCell(rules.customerCodeCell).value = code;
  ws.getCell(rules.orderNumberCell).value = order.order_number;

  // Keep the look of the template's first item line, then clear its sample lines.
  const first = rules.firstItemRow;
  const cols = [rules.codeCol, rules.nameCol, rules.qtyCol, rules.caseFactorCol, rules.unitPriceCol, rules.totalCol].filter(Boolean);
  const looks = new Map(cols.map((c) => [c, { ...ws.getCell(`${c}${first}`).style }]));
  const height = ws.getRow(first).height;
  if (ws.rowCount >= first) ws.spliceRows(first, ws.rowCount - first + 1);

  items.forEach((it, i) => {
    const r = first + i;
    const put = (c: string, v: ExcelJS.CellValue) => {
      if (!c) return;
      const cell = ws.getCell(`${c}${r}`);
      cell.value = v;
      const look = looks.get(c);
      if (look) cell.style = { ...look };
    };
    put(rules.codeCol, it.sku);
    put(rules.nameCol, it.name);
    put(rules.qtyCol, it.qty);
    put(rules.caseFactorCol, rules.caseFactorValue);
    put(rules.unitPriceCol, rules.unitPriceValue);
    put(rules.totalCol, Math.round(it.qty * rules.unitPriceValue * 100) / 100);
    if (height) ws.getRow(r).height = height;
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const orderSheetFilename = (order: Pick<Order, "order_number">) => `${order.order_number}.xlsx`;
