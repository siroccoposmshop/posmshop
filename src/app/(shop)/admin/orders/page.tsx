import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, money } from "@/lib/format";
import type { Order } from "@/lib/types";
import { StatusSelect } from "./StatusSelect";

export const metadata = { title: "All orders" };
export const dynamic = "force-dynamic";

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; market?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const db = createAdminClient();
  let q = db.from("orders").select("*").order("created_at", { ascending: false }).limit(300);
  if (sp.market) q = q.eq("market", sp.market);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.q) {
    const s = sp.q.replace(/[%,()]/g, " ");
    q = q.or(`order_number.ilike.%${s}%,account_name.ilike.%${s}%,account_number.ilike.%${s}%,kam_email.ilike.%${s}%`);
  }
  const { data } = await q;
  const orders = (data as Order[]) ?? [];

  return (
    <div>
      <h1 className="accent-square text-3xl text-brand-black">All orders</h1>
      <form className="mt-4 grid gap-2 sm:grid-cols-4">
        <input name="q" defaultValue={sp.q} placeholder="Order, account or KAM" className="field sm:col-span-2" />
        <select name="market" defaultValue={sp.market ?? ""} className="field">
          <option value="">All markets</option>
          <option value="UAE">UAE</option>
          <option value="OMN">Oman</option>
          <option value="QAT">Qatar</option>
          <option value="BHR">Bahrain</option>
        </select>
        <div className="flex gap-2">
          <select name="status" defaultValue={sp.status ?? ""} className="field">
            <option value="">Any status</option>
            <option value="submitted">Submitted</option>
            <option value="processing">Processing</option>
            <option value="dispatched">Dispatched</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className="btn btn-secondary !px-4">Go</button>
        </div>
      </form>

      <div className="bento mt-4 overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Date</th>
              <th>Market</th>
              <th>Account</th>
              <th>KAM</th>
              <th className="text-right">Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="whitespace-nowrap">
                  <Link href={`/orders/${o.id}`} className="font-medium text-brand-green underline">
                    {o.order_number}
                  </Link>
                </td>
                <td className="whitespace-nowrap">{formatDate(o.created_at, true)}</td>
                <td>{o.market}</td>
                <td>
                  {o.account_name}
                  <span className="block text-xs">#{o.account_number}</span>
                </td>
                <td>{o.kam_name || o.kam_email}</td>
                <td className="whitespace-nowrap text-right">{money(o.total_value, o.currency)}</td>
                <td>
                  <StatusSelect id={o.id} status={o.status} />
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={7} className="text-sm">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
