import { redirect } from "next/navigation";

/** Reports moved to POSM Shop (everyone can see theirs). Keeps old links working. */
export default async function OldReports({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
  redirect(qs ? `/reports?${qs}` : "/reports");
}
