import "server-only";
import ExcelJS from "exceljs";

/** The page's filters (and year) from a download link's query string. */
export function queryOf(req: Request): Record<string, string[]> {
  const q = new URL(req.url).searchParams;
  return Object.fromEntries([...new Set(q.keys())].map((k) => [k, q.getAll(k)]));
}

/** Green bold header, frozen first row (and first columns), filters on. */
export function styleSheet(ws: ExcelJS.Worksheet, frozenCols = 0) {
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF58A244" } };
  ws.views = [{ state: "frozen", ySplit: 1, xSplit: frozenCols }];
  ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columnCount } };
}

export async function xlsxResponse(wb: ExcelJS.Workbook, name: string) {
  return new Response((await wb.xlsx.writeBuffer()) as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

export const asDate = (d: string | null | undefined) => (d ? new Date(d) : "");
export const plainCode = (c: string) => (c.startsWith("TBC-") ? "" : c);
