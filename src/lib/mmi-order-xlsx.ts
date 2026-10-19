import "server-only";
import JSZip from "jszip";
import { MMI_ORDER_TEMPLATE_BASE64 } from "@/lib/templates/mmi-order-template";
import type { Order, OrderItem } from "@/lib/types";
import { friendlyAccountName } from "@/lib/format";

/**
 * The order sheet attached for MMI Customer Service, built from their template
 * (src/lib/templates/mmi-order.xlsx). Only the sheet's cell data is rewritten, so the logo,
 * "NEW ORDER" box, column widths and styles stay exactly as designed.
 */

// Cell style ids in the template's styles.xml.
const S = {
  frame: 1, // grey side/edge cells
  gap: 2, // grey spacer
  gapLeft: 3,
  header: 5, // title row (bottom border)
  headerGap: 6,
  text: 7, // 10pt Roboto
  date: 8, // dddd, mmmm dd, yyyy
  value: 9, // left-aligned 10pt
  kamLink: 10,
  emailLink: 11,
  phone: 12, // text format
  comments: 13, // top-left, merged C:E
  gapLeft2: 14,
  tableHead: 15, // bottom border
  tableGap: 16,
};
const MIN_ITEM_ROWS = 6;

function xmlEsc(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Cell = { s: number; text?: string; num?: number };

function cellXml(ref: string, c: Cell) {
  if (c.num !== undefined) return `<c r="${ref}" s="${c.s}"><v>${c.num}</v></c>`;
  if (c.text) return `<c r="${ref}" s="${c.s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(c.text)}</t></is></c>`;
  return `<c r="${ref}" s="${c.s}"/>`;
}

/** One sheet row: B and F are the grey frame, C–E the content. */
function rowXml(r: number, cde: [Cell, Cell, Cell], height?: number) {
  const ht = height ? ` ht="${height}" customHeight="1"` : "";
  const [c, d, e] = cde;
  return (
    `<row r="${r}" spans="2:6"${ht} x14ac:dyDescent="0.25">` +
    cellXml(`B${r}`, { s: S.frame }) +
    cellXml(`C${r}`, c) +
    cellXml(`D${r}`, d) +
    cellXml(`E${r}`, e) +
    cellXml(`F${r}`, { s: S.frame }) +
    `</row>`
  );
}

/** Excel date serial for the order's date in Dubai. */
function excelDate(iso: string) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date(iso));
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000 + 25569;
}

export function mmiOrderFilename(order: Order) {
  return `${order.order_number}.xlsx`;
}

export async function buildMmiOrderXlsx(order: Order, items: OrderItem[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(Buffer.from(MMI_ORDER_TEMPLATE_BASE64, "base64"));
  const sheetPath = "xl/worksheets/sheet1.xml";
  const relsPath = "xl/worksheets/_rels/sheet1.xml.rels";
  const sheet = await zip.file(sheetPath)!.async("string");
  const rels = await zip.file(relsPath)!.async("string");

  const label = (text: string): Cell => ({ s: S.text, text });
  const blank = (s = S.text): Cell => ({ s });
  const customer = order.parent_number ?? order.account_number;

  const rows: string[] = [
    rowXml(1, [blank(S.frame), blank(S.frame), blank(S.frame)], 6),
    rowXml(2, [blank(S.header), blank(S.header), blank(S.header)], 40.5),
    rowXml(3, [blank(S.headerGap), blank(S.headerGap), blank(S.headerGap)], 4.5),
    rowXml(4, [label("Order Date:"), { s: S.date, num: excelDate(order.created_at) }, blank(S.date)]),
    rowXml(5, [label("Order Number:"), { s: S.value, text: order.order_number }, blank()]),
    rowXml(6, [label("KAM:"), { s: S.kamLink, text: order.kam_email }, blank()]),
    rowXml(7, [blank(S.gap), blank(S.gapLeft), blank(S.gap)], 4.5),
    rowXml(8, [label("Account:"), { s: S.value, text: (friendlyAccountName(order.parent_name) || order.account_name).toUpperCase() }, blank()]),
    rowXml(9, [
      label("Customer Number:"),
      /^\d+$/.test(customer) ? { s: S.value, num: Number(customer) } : { s: S.value, text: customer },
      blank(),
    ]),
    rowXml(10, [label("Outlet:"), { s: S.value, text: order.account_name }, blank()]),
    rowXml(11, [label("Contact:"), { s: S.value, text: order.contact_name }, blank()]),
    rowXml(12, [label("Contact email:"), { s: S.emailLink, text: order.contact_email }, blank()]),
    rowXml(13, [label("Contact Number:"), { s: S.phone, text: order.contact_mobile.replace(/\s+/g, "") }, blank()]),
    rowXml(14, [blank(S.frame), blank(S.gapLeft2), blank(S.frame)], 4.5),
    rowXml(15, [{ s: S.tableHead, text: "Item Name" }, { s: S.tableHead, text: "SKU Code" }, { s: S.tableHead, text: "Qty " }]),
    rowXml(16, [blank(S.tableGap), blank(S.tableGap), blank(S.tableGap)], 6),
  ];

  let r = 17;
  for (const i of items) {
    rows.push(rowXml(r++, [{ s: S.text, text: i.name }, { s: S.text, text: i.sku }, { s: S.text, num: i.qty }]));
  }
  while (r < 17 + MIN_ITEM_ROWS) rows.push(rowXml(r++, [blank(), blank(), blank()]));
  rows.push(rowXml(r++, [blank(), blank(), blank()]));
  rows.push(rowXml(r++, [blank(S.frame), blank(S.frame), blank(S.frame)], 4.5));
  rows.push(rowXml(r++, [label("Comments:"), blank(), blank()]));
  const commentsRow = r;
  rows.push(rowXml(r++, [{ s: S.comments, text: order.notes ?? "" }, blank(S.comments), blank(S.comments)], 35.25));
  rows.push(rowXml(r, [blank(S.frame), blank(S.frame), blank(S.frame)], 5.25));
  const lastRow = r;

  const out = sheet
    .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="B1:F${lastRow}"/>`)
    .replace(/<selection [^>]*\/>/, `<selection activeCell="D5" sqref="D5"/>`)
    .replace(/<sheetData>[\s\S]*<\/sheetData>/, `<sheetData>${rows.join("")}</sheetData>`)
    .replace(
      /<mergeCells[\s\S]*?<\/mergeCells>/,
      `<mergeCells count="3"><mergeCell ref="C2:E2"/><mergeCell ref="D4:E4"/><mergeCell ref="C${commentsRow}:E${commentsRow}"/></mergeCells>`,
    );

  const outRels = rels
    .replace(/(Id="rId2"[^>]*Target=")mailto:[^"]*"/, `$1mailto:${xmlEsc(order.kam_email)}"`)
    .replace(/(Id="rId1"[^>]*Target=")mailto:[^"]*"/, `$1mailto:${xmlEsc(order.contact_email)}"`);

  zip.file(sheetPath, out);
  zip.file(relsPath, outRels);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
