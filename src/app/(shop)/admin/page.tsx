import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, money } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { Item, Order } from "@/lib/types";
import { EtaButton } from "./EtaButton";
import { Panel } from "./Panel";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const db = createAdminClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [orders30, recent, oos, low, counts] = await Promise.all([
    db.from("orders").select("total_value, status").gte("created_at", since).neq("status", "cancelled"),
    db.from("orders").select("*").order("created_at", { ascending: false }).limit(8),
    db.from("items").select("*").eq("visible", true).lte("stock", 0).order("brand").limit(50),
    db.from("items").select("*").eq("visible", true).gt("stock", 0).gt("months_of_stock", 0).lt("months_of_stock", 6),
    Promise.all([
      db.from("items").select("id", { count: "exact", head: true }),
      db.from("accounts").select("id", { count: "exact", head: true }),
      db.from("profiles").select("id", { count: "exact", head: true }),
    ]),
  ]);

  const value30 = (orders30.data ?? []).reduce((n, o) => n + Number(o.total_value), 0);
  const [items, accounts, users] = counts.map((c) => c.count ?? 0);
  const oosItems = (oos.data as Item[]) ?? [];
  const recentOrders = (recent.data as Order[]) ?? [];

  // Running low: under 6 months of cover that runs out before the next delivery (or none is due).
  const now = Date.now();
  const lowItems = ((low.data as Item[]) ?? [])
    .map((item) => ({
      item,
      toEta: item.eta ? (Date.parse(item.eta) - now) / (86400000 * DAYS_PER_MONTH) : null,
    }))
    .filter(({ item, toEta }) => toEta === null || toEta > Number(item.months_of_stock))
    .sort((a, b) => Number(a.item.months_of_stock) - Number(b.item.months_of_stock));

  const tiles = [
    { label: "Orders · 30 days", value: (orders30.data ?? []).length.toLocaleString() },
    { label: "Value · 30 days", value: money(value30) },
    { label: "Items", value: items.toLocaleString(), href: "/admin/items" },
    { label: "Accounts", value: accounts.toLocaleString(), href: "/admin/accounts" },
    { label: "Users", value: users.toLocaleString(), href: "/admin/users" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t, i) => {
          const body = (
            <>
              <p className={`font-display text-xs uppercase tracking-wide ${i === 0 ? "text-white/80" : ""}`}>{t.label}</p>
              <p className={`mt-1 font-display text-2xl font-medium ${i === 0 ? "" : "text-brand-black"}`}>{t.value}</p>
            </>
          );
          const cls = i === 0 ? "bento-green" : "bento";
          return t.href ? (
            <Link key={t.label} href={t.href} className={`${cls} hover:ring-2 hover:ring-brand-green`}>
              {body}
            </Link>
          ) : (
            <div key={t.label} className={cls}>
              {body}
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <Panel title="Latest orders" count={recentOrders.length} tone="neutral">
          <div className="mb-2 text-right">
            <Link href="/admin/orders" className="text-sm underline">
              All orders
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm">No orders yet.</p>
          ) : (
            <table className="table">
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/orders/${o.id}`} className="font-medium text-brand-green underline">
                        {o.order_number}
                      </Link>
                      <span className="block text-xs">{formatDate(o.created_at, true)}</span>
                    </td>
                    <td>
                      {o.account_name}
                      <span className="block text-xs">{o.kam_name || o.kam_email}</span>
                    </td>
                    <td className="whitespace-nowrap text-right">{money(o.total_value)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Out of stock" count={oosItems.length} tone="red">
          {oosItems.length === 0 ? (
            <p className="text-sm">Nothing visible is out of stock.</p>
          ) : (
            <table className="table">
              <tbody>
                {oosItems.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <ItemCell item={i} />
                    </td>
                    <td className="text-right">
                      <EtaButton id={i.id} eta={i.eta} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Running low" count={lowItems.length} tone="amber">
          <p className="mb-2 text-xs">
            Under 6 months of stock (from the last Excel upload) that will run out before the next delivery arrives, or
            with no delivery due.
          </p>
          {lowItems.length === 0 ? (
            <p className="text-sm">Nothing is running low.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Stock left</th>
                  <th className="text-right">Next delivery</th>
                </tr>
              </thead>
              <tbody>
                {lowItems.map(({ item, toEta }) => (
                  <tr key={item.id}>
                    <td>
                      <ItemCell item={item} />
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <span className="font-medium text-brand-black">{monthsLabel(Number(item.months_of_stock))}</span>
                      <span className="block text-xs">{item.stock.toLocaleString()} units</span>
                    </td>
                    <td className="text-right">
                      <EtaButton id={item.id} eta={item.eta} />
                      {toEta !== null && <span className="block text-xs">in {monthsLabel(toEta)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}

const DAYS_PER_MONTH = 30.44;

function monthsLabel(months: number) {
  if (months < 1) {
    const weeks = Math.max(1, Math.round((months * DAYS_PER_MONTH) / 7));
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  const m = Math.round(months * 10) / 10;
  return `${m} month${m === 1 ? "" : "s"}`;
}

function ItemCell({ item }: { item: Item }) {
  return (
    <>
      <Link href={`/admin/items/${item.id}`} className="font-medium text-brand-black underline">
        {item.name}
      </Link>
      <span className="block text-xs">
        {item.brand} · {item.sku}
      </span>
    </>
  );
}
