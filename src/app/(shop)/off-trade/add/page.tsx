import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseOffTrade, isBar, storeLabel } from "@/lib/off-trade";
import { AddProjectForm, type StoreOption } from "./AddProjectForm";

export const metadata = { title: "Add a project" };
export const dynamic = "force-dynamic";

/** For the TM team: record projects already done (store, category, date, cost), one after another. */
export default async function AddProjectPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const profile = await requireProfile();
  if (!canUseOffTrade(profile)) redirect("/");
  const { store } = await searchParams;
  const { data } = await createAdminClient()
    .from("off_trade_stores")
    .select("id, name, chain, area, market, tmam, store_type")
    .eq("active", true)
    .order("name")
    .limit(5000);
  const stores: StoreOption[] = (data ?? []).map((s) => ({
    id: s.id as string,
    name: storeLabel(s.name as string, s.chain as string | null),
    search: s.name as string,
    detail: [s.chain, s.area ?? s.market, isBar(s as { store_type: string | null }) ? "Bar" : null, s.tmam ? `TM ${s.tmam}` : null]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/off-trade" className="text-sm underline">
        ← Off trade
      </Link>
      <div>
        <h1 className="accent-square text-3xl text-brand-black">Add a project</h1>
        <p className="mt-1 text-sm">Record something already done: the store, what, when and what it cost. It shows in History straight away.</p>
      </div>
      <AddProjectForm stores={stores} initialStore={store ?? null} />
    </div>
  );
}
