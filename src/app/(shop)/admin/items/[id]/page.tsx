import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Item, Market } from "@/lib/types";
import { ItemForm } from "./ItemForm";
import { ImageManager } from "./ImageManager";

export const metadata = { title: "Edit item" };
export const dynamic = "force-dynamic";

export default async function EditItem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: markets } = await db.from("markets").select("*").order("sort");
  const { data: brandRows } = await db.from("items").select("brand");
  const brands = [...new Set((brandRows ?? []).map((b) => b.brand as string))].sort();

  let item: Item | null = null;
  if (id !== "new") {
    const { data } = await db.from("items").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    item = data as Item;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/items" className="text-sm underline">
        ← All items
      </Link>
      <h1 className="accent-square mt-2 text-3xl text-brand-black">{item ? item.name : "New item"}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <ItemForm item={item} markets={(markets as Market[]) ?? []} brands={brands} />
        {item ? (
          <ImageManager id={item.id} path={item.image_path} name={item.name} />
        ) : (
          <p className="bento h-fit text-sm">Save the item first, then add its image.</p>
        )}
      </div>
    </div>
  );
}
