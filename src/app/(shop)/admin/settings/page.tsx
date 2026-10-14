import { createAdminClient } from "@/lib/supabase/admin";
import type { Market } from "@/lib/types";
import { MarketForm } from "./MarketForm";

export const metadata = { title: "Markets" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { data } = await createAdminClient().from("markets").select("*").order("sort");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="accent-square text-3xl text-brand-black">Markets</h1>
        <p className="mt-2 max-w-3xl text-sm">
          Each order is emailed to the Customer Service mailbox for its market (Dubai for the UAE). The
          delivery days appear in the customer email: “Delivery is expected in the next XX days”.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {((data as Market[]) ?? []).map((m) => (
          <MarketForm key={m.code} market={m} />
        ))}
      </div>
    </div>
  );
}
