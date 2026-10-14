import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, money } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { Item, Order } from "@/lib/types";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const db = createAdminClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [orders30, recent, oos, counts, setup] = await Promise.all([
    db.from("orders").select("total_value, status").gte("created_at", since).neq("status", "cancelled"),
    db.from("orders").select("*").order("created_at", { ascending: false }).limit(8),
    db.from("items").select("*").eq("visible", true).lte("stock", 0).order("brand").limit(50),
    Promise.all([
      db.from("items").select("id", { count: "exact", head: true }),
      db.from("accounts").select("id", { count: "exact", head: true }),
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("items").select("id", { count: "exact", head: true }).is("image_path", null),
    ]),
    db.from("markets").select("name, cs_email"),
  ]);

  const value30 = (orders30.data ?? []).reduce((n, o) => n + Number(o.total_value), 0);
  const [items, accounts, users, noImage] = counts.map((c) => c.count ?? 0);
  const missingCs = (setup.data ?? []).filter((m) => !m.cs_email).map((m) => m.name);
  const oosItems = (oos.data as Item[]) ?? [];

  const tiles = [
    { label: "Orders · 30 days", value: (orders30.data ?? []).length.toLocaleString() },
    { label: "Value · 30 days", value: money(value30) },
    { label: "Items", value: items.toLocaleString(), href: "/admin/items" },
    { label: "Accounts", value: accounts.toLocaleString(), href: "/admin/accounts" },
    { label: "Users", value: users.toLocaleString(), href: "/admin/users" },
  ];

  return (
    <div className="space-y-6">
      {(missingCs.length > 0 || items === 0 || noImage > 0) && (
        <div className="bento border-l-4 border-brand-red">
          <h2 className="text-lg text-brand-black">Setup checklist</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
            {items === 0 && (
              <li>
                Upload the <Link href="/admin/import" className="underline">2026 POSM Budgeting</Link> Excel to load items and accounts.
              </li>
            )}
            {missingCs.length > 0 && (
              <li>
                Set the Customer Service email for: {missingCs.join(", ")} (<Link href="/admin/settings" className="underline">Markets</Link>).
              </li>
            )}
            {noImage > 0 && (
              <li>
                {noImage} items have no image yet (<Link href="/admin/items?filter=noimage" className="underline">view</Link>).
              </li>
            )}
          </ul>
        </div>
      )}

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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bento overflow-x-auto">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl text-brand-black">Latest orders</h2>
            <Link href="/admin/orders" className="text-sm underline">
              All orders
            </Link>
          </div>
          <table className="table">
            <tbody>
              {((recent.data as Order[]) ?? []).map((o) => (
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
              {!recent.data?.length && (
                <tr>
                  <td className="text-sm">No orders yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="bento overflow-x-auto">
          <h2 className="mb-3 text-xl text-brand-black">Out of stock</h2>
          {oosItems.length === 0 ? (
            <p className="text-sm">Nothing visible is out of stock.</p>
          ) : (
            <table className="table">
              <tbody>
                {oosItems.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/admin/items/${i.id}`} className="font-medium text-brand-black underline">
                        {i.name}
                      </Link>
                      <span className="block text-xs">
                        {i.brand} · {i.sku}
                      </span>
                    </td>
                    <td className="text-right">
                      {i.eta ? (
                        <span className="text-xs">ETA {formatDate(i.eta)}</span>
                      ) : (
                        <span className="badge bg-brand-red text-white">Add ETA</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
