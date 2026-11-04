import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getProjectReportRows, projectReportScope, readProjectFilters } from "@/lib/project-reports";
import { ReportsView } from "./ReportsView";

export const metadata = { title: "Project reports" };
export const dynamic = "force-dynamic";

export default async function ProjectReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireProfile();
  const scope = await projectReportScope(profile);
  if (scope === false) redirect("/projects");

  const f = readProjectFilters(await searchParams);
  let data;
  try {
    data = await getProjectReportRows(f, scope);
  } catch {
    return (
      <div className="bento mx-auto max-w-xl">
        <h1 className="text-2xl text-brand-black">Projects isn&apos;t set up yet</h1>
        <p className="mt-2 text-sm">Run the Commerce Hub migrations in Supabase, then reload this page.</p>
      </div>
    );
  }
  return <ReportsView rows={data.rows} all={data.all} f={f} team={!!scope} />;
}
