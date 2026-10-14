import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getReportRows, readFilters, toCsv, toXlsx } from "@/lib/reports";

export async function GET(request: NextRequest) {
  await requireAdmin();
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const rows = await getReportRows(readFilters(sp));
  const stamp = new Date().toISOString().slice(0, 10);

  if (sp.format === "csv") {
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="posm-report-${stamp}.csv"`,
      },
    });
  }
  const buffer = await toXlsx(rows);
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="posm-report-${stamp}.xlsx"`,
    },
  });
}
