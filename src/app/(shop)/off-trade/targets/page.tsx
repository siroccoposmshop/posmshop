import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { canUseOffTrade, loadOffTrade, readOffTradeFilters, readTargetYear } from "@/lib/off-trade";
import { TargetsView } from "./TargetsView";

export const metadata = { title: "Targets" };
export const dynamic = "force-dynamic";

export default async function TargetsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireProfile();
  if (!canUseOffTrade(profile)) redirect("/");
  const sp = await searchParams;
  const f = readOffTradeFilters(sp);
  const year = readTargetYear(sp.year);
  let all;
  try {
    all = await loadOffTrade();
  } catch {
    return (
      <div className="bento mx-auto max-w-xl">
        <h1 className="text-2xl text-brand-black">Off trade isn&apos;t set up yet</h1>
        <p className="mt-2 text-sm">Run the off-trade migrations in Supabase, then reload this page.</p>
      </div>
    );
  }
  return <TargetsView all={all} f={f} year={year} />;
}
