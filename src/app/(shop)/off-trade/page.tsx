import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { canUseOffTrade, loadOffTrade, readOffTradeFilters, type StoreView } from "@/lib/off-trade";
import { OffTradeView } from "./OffTradeView";

export const metadata = { title: "Off trade" };
export const dynamic = "force-dynamic";

export default async function OffTradePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireProfile();
  if (!canUseOffTrade(profile)) redirect("/");
  const sp = await searchParams;
  const f = readOffTradeFilters(sp);

  let all: StoreView[];
  try {
    all = await loadOffTrade();
  } catch {
    return (
      <div className="bento mx-auto max-w-xl">
        <h1 className="text-2xl text-brand-black">Off trade isn&apos;t set up yet</h1>
        <p className="mt-2 text-sm">
          Run <code>supabase/migrations/20261109000000_off_trade.sql</code> in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }
  if (!all.length) {
    return (
      <div className="bento mx-auto max-w-xl space-y-3">
        <h1 className="accent-square text-3xl text-brand-black">Off trade</h1>
        <p className="text-sm">No stores yet. Upload the store list (and any past or planned projects) to see the dashboard.</p>
        <Link href="/off-trade/import" className="btn btn-primary">
          Upload stores
        </Link>
      </div>
    );
  }

  return <OffTradeView all={all} f={f} />;
}
