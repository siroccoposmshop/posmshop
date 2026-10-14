import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { DeliveryCards, OrderLinesTable } from "@/components/OrderSummary";
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
      <Logo className="mb-6 hidden h-10 w-auto print:block" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="accent-square text-4xl text-brand-black">{placed ? "Order placed" : "Order"}</h1>
          <div className="mt-2">
            <StatusBadge status={order.status} large />
          </div>
        </div>
        <div className="min-w-0 max-w-[60%] text-right text-xs leading-snug sm:text-sm">
          <p className="font-display text-base font-medium text-brand-black sm:text-lg">{order.order_number}</p>
          <p>{formatDate(order.created_at, true)}</p>
          <p className="truncate">By {order.kam_name || order.kam_email}</p>
        </div>
      </div>

      {placed && (
        <div className="bento-green no-print mt-6">
          <p>
            <span className="highlight">{order.order_number}</span> has been sent to Customer Service. A confirmation
            is on its way to you and {order.contact_email}.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <DeliveryCards
          info={{
            outletName: order.account_name,
            outletNumber: order.account_number,
            parentName: order.parent_name,
            parentNumber: order.parent_number,
            market: order.market,
            contactName: order.contact_name,
            contactMobile: order.contact_mobile,
            contactEmail: order.contact_email,
          }}
        />
        <OrderLinesTable
          total={order.total_value}
          lines={items.map((i) => ({
            key: i.id,
            name: i.name,
            brand: i.brand,
            sku: i.sku,
            image_path: i.image_path,
            qty: i.qty,
            lineValue: i.line_value,
          }))}
        />
        {order.notes && (
          <div className="bento">
            <h2 className="label">Notes for Customer Service</h2>
            <p className="whitespace-pre-line text-sm text-brand-black">{order.notes}</p>
          </div>
        )}
      </div>

      <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/orders" className="btn btn-secondary">
          ← My orders
        </Link>
        <OrderActions orderId={order.id} emailsSentAt={order.emails_sent_at} />
      </div>
      {placed && (
        <Link href="/" className="no-print btn btn-primary mt-5 w-full !py-4">
          Start a new order
        </Link>
      )}
    </div>
  );
}
