import { requireAdmin } from "@/lib/auth";
import { buildOrderSheet, loadOrderSheetSettings } from "@/lib/order-sheet";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order, OrderItem } from "@/lib/types";

/** The order file as it would be sent: for the latest order, or a made-up one if there's none yet. */
export async function GET() {
  await requireAdmin();
  const db = createAdminClient();
  const settings = await loadOrderSheetSettings();
  const { data: last } = await db.from("orders").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  let order: Pick<Order, "order_number" | "account_number" | "account_name" | "parent_number" | "parent_name"> = {
    order_number: "POSM-SAMPLE-1",
    account_number: "50308",
    account_name: "SAMPLE OUTLET",
    parent_number: null,
    parent_name: null,
  };
  let items: Pick<OrderItem, "sku" | "name" | "qty">[] = [
    { sku: "SKU01", name: "Sample item one", qty: 24 },
    { sku: "SKU02", name: "Sample item two", qty: 12 },
  ];
  let market = "DXB";
  if (last) {
    order = last as Order;
    market = (last as Order).market;
    const { data } = await db.from("order_items").select("sku, name, qty").eq("order_id", last.id).order("brand").order("name");
    if (data?.length) items = data as typeof items;
  }
  const { data: m } = await db.from("markets").select("salesforce_company_codes").eq("code", market).maybeSingle();
  const buf = await buildOrderSheet(order, items, ((m?.salesforce_company_codes as string[] | null) ?? [])[0] ?? null, settings);
  return new Response(buf as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sample-${order.order_number}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
