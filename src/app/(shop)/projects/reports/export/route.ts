import type { NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { getProjectReportRows, projectReportScope, projectsToCsv, projectsToXlsx, readProjectFilters } from "@/lib/project-reports";

export async function GET(request: NextRequest) {
  const profile = await requireProfile();
  const scope = await projectReportScope(profile);
  if (scope === false) return new Response("Not allowed", { status: 403 });
  const sp: Record<string, string | string[]> = {};
  for (const [k, v] of request.nextUrl.searchParams.entries()) sp[k] = k in sp ? [...[sp[k]].flat(), v] : v;
  const { rows } = await getProjectReportRows(readProjectFilters(sp), scope);
  const stamp = new Date().toISOString().slice(0, 10);
  if (sp.format === "csv") {
    return new Response(projectsToCsv(rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="project-report-${stamp}.csv"` },
    });
  }
  const buffer = await projectsToXlsx(rows);
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="project-report-${stamp}.xlsx"`,
    },
  });
}
