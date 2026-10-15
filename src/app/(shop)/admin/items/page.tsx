import { MARKETS } from "@/lib/markets";
import { LiveFilters } from "@/components/LiveFilters";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, money } from "@/lib/format";
import { ItemImage } from "@/components/ItemImage";
import type { Item } from "@/lib/types";
import { VisibilityToggle } from "./VisibilityToggle";

export const metadata = { title: "Items" };
export const dynamic = "force-dynamic";

type Search = { q?: string; brand?: string; market?: string; filter?: string };

export default async function AdminItems({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const db = createAdminClient();
  let query = db.from("items").select("*").order("brand").order("name");
  if (sp.brand) query = query.eq("brand", sp.brand);
  if (sp.market) query = query.contains("markets", [sp.market]);
  if (sp.filter === "noimage") query = query.is("image_path", null);
  if (sp.filter === "oos") query = query.lte("stock", 0);
  if (sp.filter === "hidden") query = query.eq("visible", false);
  if (sp.q) {
    const q = sp.q.replace(/[%,()]/g, " ");
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,category.ilike.%${q}%`);
  }
  const [{ data }, { data: brandRows }] = await Promise.all([query, db.from("items").select("brand")]);
  const items = (data as Item[]) ?? [];
  const brands = [...new Set((brandRows ?? []).map((b) => b.brand as string))].sort();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="accent-square text-3xl text-brand-black">Items</h1>
        <Link href="/admin/items/new" className="btn btn-primary">
          + Add item
        </Link>
      </div>

      <LiveFilters className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Search name, SKU, category" type="search" autoComplete="off" className="field sm:col-span-2 lg:col-span-1" />
        <select name="brand" defaultValue={sp.brand ?? ""} className="field">
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <select name="market" defaultValue={sp.market ?? ""} className="field">
          <option value="">All markets</option>
          {MARKETS.map((m) => (
            <option key={m.code} value={m.code}>
              {m.name}
            </option>
          ))}
        </select>
        <select name="filter" defaultValue={sp.filter ?? ""} className="field">
            <option value="">Everything</option>
            <option value="oos">Out of stock</option>
            <option value="noimage">No image</option>
            <option value="hidden">Hidden</option>
          </select>
      </LiveFilters>

      <p className="mt-3 text-sm">{items.length} items</p>
      <div className="bento mt-2 overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr>
              <th />
              <th>Item</th>
              <th>Category</th>
              <th className="text-right">Value</th>
              <th className="text-right">Stock</th>
              <th>Limits</th>
              <th>Markets</th>
              <th>Visible</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className={i.visible ? "" : "opacity-60"}>
                <td className="w-16">
                  <div className="h-12 w-12 overflow-hidden rounded bg-brand-light">
                    <ItemImage path={i.image_path} alt="" />
                  </div>
                </td>
                <td>
                  <Link href={`/admin/items/${i.id}`} className="font-medium text-brand-black underline">
                    {i.name}
                  </Link>
                  <span className="block text-xs">
                    {i.brand} · {i.sku}
                  </span>
                </td>
                <td>{i.category}</td>
                <td className="whitespace-nowrap text-right">
                  {money(i.value)}
                  <span className="block text-xs">{money(i.value, "USD")}</span>
                </td>
                <td className="text-right">
                  {i.stock <= 0 ? (
                    <span className="text-brand-red">
                      0{i.eta ? <span className="block text-xs">ETA {formatDate(i.eta)}</span> : <span className="block text-xs">no ETA</span>}
                    </span>
                  ) : (
                    i.stock.toLocaleString()
                  )}
                </td>
                <td className="whitespace-nowrap text-xs">
                  ×{i.order_multiple}
                  {i.max_per_order ? ` · max ${i.max_per_order}` : ""}
                </td>
                <td className="text-xs">{i.markets.join(", ")}</td>
                <td>
                  <VisibilityToggle id={i.id} visible={i.visible} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
