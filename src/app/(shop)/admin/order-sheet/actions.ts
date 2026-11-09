"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { cleanRules, type OrderSheetRules } from "@/lib/order-sheet";
import { createAdminClient } from "@/lib/supabase/admin";

type State = { error?: string; ok?: boolean; message?: string } | null;
const MIGRATION = "Run supabase/migrations/20261118000000_order_sheet.sql in Supabase first.";
const dbError = (m: string) => (/order_sheet_settings|does not exist|schema cache/i.test(m) ? MIGRATION : m);

const FIELDS: (keyof OrderSheetRules)[] = [
  "firstItemRow", "codeCol", "nameCol", "qtyCol", "caseFactorCol", "caseFactorValue", "unitPriceCol", "unitPriceValue", "totalCol",
  "accountNameCell", "customerCodeCell", "orderNumberCell", "customerCodeFormat", "accountLevel",
];

export async function saveOrderSheetRules(_: State, formData: FormData): Promise<State> {
  const me = await requireAdmin();
  const raw = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "").trim()]));
  const rules = cleanRules(raw);
  // Anything typed that wasn't a valid cell or column fell back to the default: say so.
  const changed = FIELDS.filter((k) => raw[k] !== "" && String(rules[k]).toUpperCase() !== String(raw[k]).toUpperCase() && k !== "unitPriceValue" && k !== "firstItemRow");
  if (changed.length) return { error: `Check these: ${changed.join(", ")} (a column is a letter like D; a cell is like F2).` };
  const { error } = await createAdminClient()
    .from("order_sheet_settings")
    .upsert({ id: 1, rules, updated_at: new Date().toISOString(), updated_by: me.id });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/admin/order-sheet");
  return { ok: true };
}

export async function uploadOrderTemplate(_: State, formData: FormData): Promise<State> {
  const me = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose the .xlsx template." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "The template must be an .xlsx file (save it as Excel Workbook)." };
  if (file.size > 2_000_000) return { error: "That file is over 2 MB; the template should be a small sheet." };
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    if (!wb.worksheets.length) return { error: "That workbook has no sheet." };
  } catch {
    return { error: "That file couldn't be read as an Excel workbook." };
  }
  const { error } = await createAdminClient()
    .from("order_sheet_settings")
    .upsert({ id: 1, template_b64: buf.toString("base64"), template_name: file.name, updated_at: new Date().toISOString(), updated_by: me.id });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/admin/order-sheet");
  return { ok: true, message: `Template "${file.name}" saved. Download a sample to check it.` };
}

export async function resetOrderTemplate(): Promise<State> {
  const me = await requireAdmin();
  const { error } = await createAdminClient()
    .from("order_sheet_settings")
    .upsert({ id: 1, template_b64: null, template_name: null, updated_at: new Date().toISOString(), updated_by: me.id });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/admin/order-sheet");
  return { ok: true };
}
