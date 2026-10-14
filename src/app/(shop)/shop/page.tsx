import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Item } from "@/lib/types";
import { Catalogue } from "./Catalogue";

export const metadata = { title: "Items" };
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("visible", true)
    .order("brand")
    .order("category", { nullsFirst: false })
    .order("name");
  return <Catalogue items={(data as Item[]) ?? []} />;
}
