import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { formatDate, money } from "@/lib/format";
import { ItemImage } from "@/components/ItemImage";
import { StatusBadge } from "@/components/StatusBadge";
import { Logo } from "@/components/Logo";
import type { Order, OrderItem } from "@/lib/types";
import { OrderActions } from "./OrderActions";

export const metadata = { title: "Order" };
export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const { placed } = await searchParams;
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order) notFound();
  const { data: itemsData } = await supabase.from("order_items").select("*").eq("order_id", id).order("brand").order("name");
  const items = (itemsData as OrderItem[]) ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      {placed && (
        <div className="bento-green no-print mb-6">
          <h1 className="accent-square text-3xl">Order placed</h1>
          <p className="mt-1">
            <span className="highlight">{order.order_number}</span> has been sent to Customer Service. A
            confirmation is on its way to you and {order.contact_email}.
          </p>
        </div>
      )}

      <div className="bento">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/5 pb-5">
          <div>
            <Logo className="mb-4 hidden h-10 w-auto print:block" />
            <p className="font-display text-xs uppercase tracking-wide">POSM order</p>
            <h2 className="text-3xl text-brand-black">{order.order_number}</h2>
            <p className="text-sm">{formatDate(order.created_at, true)}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={order.status} />
          </div>
        </div>

        <dl className="grid gap-4 py-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="label">Account</dt>
            <dd className="text-brand-black">
              {order.account_name}
              <br />#{order.account_number} · {order.market}
            </dd>
          </div>
          <div>
            <dt className="label">Contact</dt>
            <dd className="text-brand-black">
              {order.contact_name}
              <br />
              {order.contact_mobile}
              <br />
              {order.contact_email}
            </dd>
          </div>
          <div>
            <dt className="label">KAM</dt>
            <dd className="text-brand-black">
              {order.kam_name || order.kam_email}
              <br />
              {order.kam_email}
            </dd>
          </div>
          {order.notes && (
            <div className="sm:col-span-3">
              <dt className="label">Notes</dt>
              <dd className="whitespace-pre-line text-brand-black">{order.notes}</dd>
            </div>
          )}
        </dl>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th colSpan={2}>Item</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="w-16">
                    <div className="h-12 w-12 overflow-hidden rounded bg-brand-light">
                      <ItemImage path={i.image_path} alt={i.name} />
                    </div>
                  </td>
                  <td>
                    <span className="block font-medium text-brand-black">{i.name}</span>
                    <span className="text-xs">
                      {i.brand} · SKU {i.sku}
                    </span>
                  </td>
                  <td className="text-right">{i.qty}</td>
                  <td className="whitespace-nowrap text-right">{money(i.unit_value, order.currency)}</td>
                  <td className="whitespace-nowrap text-right">{money(i.line_value, order.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="text-right font-display font-medium uppercase">
                  Total value
                </td>
                <td className="whitespace-nowrap text-right text-lg font-medium text-brand-black">
                  {money(order.total_value, order.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/orders" className="btn btn-secondary">
          ← My orders
        </Link>
        <OrderActions orderId={order.id} emailsSentAt={order.emails_sent_at} />
      </div>
    </div>
  );
}
