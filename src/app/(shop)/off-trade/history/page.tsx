import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { canUseOffTrade, loadOffTrade, readHistoryYear, readOffTradeFilters } from "@/lib/off-trade";
import { HistoryView } from "./HistoryView";

export const metadata = { title: "Off-trade history" };
export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireProfile();
  if (!canUseOffTrade(profile)) redirect("/");
  const sp = await searchParams;
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
  return <HistoryView all={all} f={readOffTradeFilters(sp)} year={readHistoryYear(sp.year)} />;
}
