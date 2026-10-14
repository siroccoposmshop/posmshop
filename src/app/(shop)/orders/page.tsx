import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { formatDate, money } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { Order } from "@/lib/types";

export const metadata = { title: "My orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("kam_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const orders = (data as Order[]) ?? [];

  return (
    <div>
      <h1 className="accent-square text-4xl text-brand-black">My orders</h1>
      {orders.length === 0 ? (
        <div className="bento mt-6 text-center">
          <p>You haven&apos;t placed any orders yet.</p>
          <Link href="/" className="btn btn-primary mt-4">
            Start an order
          </Link>
        </div>
      ) : (
        <>
          {/* Cards on mobile */}
          <ul className="mt-6 space-y-3 md:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="bento block">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-medium text-brand-black">{o.order_number}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 text-sm text-brand-black">{o.account_name}</p>
                  {o.parent_name && <p className="text-xs">{o.parent_name}</p>}
                  <p className="text-xs">
                    {formatDate(o.created_at)} · {money(o.total_value)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <div className="bento mt-6 hidden overflow-x-auto md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Outlet</th>
                  <th>Contact</th>
                  <th className="text-right">Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-brand-green-tint/50">
                    <td>
                      <Link href={`/orders/${o.id}`} className="font-medium text-brand-green underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{formatDate(o.created_at)}</td>
                    <td>
                      {o.account_name}
                      {o.parent_name && <span className="block text-xs">{o.parent_name}</span>}
                    </td>
                    <td>{o.contact_name}</td>
                    <td className="whitespace-nowrap text-right">{money(o.total_value)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
