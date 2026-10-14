import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { formatDate, money } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { Order } from "@/lib/types";

export const metadata = { title: "My orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const profile = await requireProfile();
  const { q } = await searchParams;
  const search = q?.trim() ?? "";
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("*")
    .eq("kam_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (search) {
    const s = search.replace(/[%,()]/g, " ");
    query = query.or(
      `order_number.ilike.%${s}%,account_name.ilike.%${s}%,account_number.ilike.%${s}%,parent_name.ilike.%${s}%,parent_number.ilike.%${s}%`,
    );
  }
  const { data } = await query;
  const orders = (data as Order[]) ?? [];

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h1 className="accent-square text-4xl text-brand-black">My orders</h1>
        <form className="w-1/2 max-w-xs" role="search">
          <label htmlFor="orders-search" className="sr-only">
            Search orders
          </label>
          <input
            id="orders-search"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search outlet, account, order"
            className="field !py-2 text-sm"
          />
        </form>
      </div>

      {orders.length === 0 ? (
        <div className="bento mt-6 text-center">
          {search ? (
            <>
              <p>No orders match “{search}”.</p>
              <Link href="/orders" className="btn btn-secondary mt-4">
                Show all orders
              </Link>
            </>
          ) : (
            <>
              <p>You haven&apos;t placed any orders yet.</p>
              <Link href="/" className="btn btn-primary mt-4">
                Start an order
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Cards on mobile */}
          <ul className="mt-6 space-y-3 md:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="bento block">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs">{formatDate(o.created_at, true)}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  {o.parent_name && <p className="mt-2 line-clamp-2 text-xs leading-snug">{o.parent_name}</p>}
                  <p className="font-display text-lg font-medium uppercase leading-tight text-brand-black">
                    {o.account_name}
                  </p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span className="font-display text-sm font-medium text-brand-green">{o.order_number}</span>
                    <span className="text-sm font-medium text-brand-black">{money(o.total_value)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="bento mt-6 hidden overflow-x-auto md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Hotel / outlet</th>
                  <th>Order</th>
                  <th className="text-right">Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-brand-green-tint/50">
                    <td className="whitespace-nowrap">{formatDate(o.created_at, true)}</td>
                    <td>
                      {o.parent_name && <span className="block text-xs">{o.parent_name}</span>}
                      <span className="font-medium text-brand-black">{o.account_name}</span>
                    </td>
                    <td className="whitespace-nowrap">
                      <Link href={`/orders/${o.id}`} className="font-medium text-brand-green underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-right">{money(o.total_value)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orders.length === 200 && <p className="mt-3 text-xs">Showing the latest 200 orders. Search to find older ones.</p>}
        </>
      )}
    </div>
  );
}
