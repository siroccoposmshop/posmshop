import { createAdminClient } from "@/lib/supabase/admin";
import { getReportRows, readFilters, summariseByItem, summariseByKam } from "@/lib/reports";
import { formatDate, money } from "@/lib/format";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = readFilters(sp);
  const db = createAdminClient();
  const [rows, { data: kams }, { data: brandRows }, { data: markets }] = await Promise.all([
    getReportRows(filters),
    db.from("profiles").select("id, email, full_name").order("email"),
    db.from("items").select("brand, category"),
    db.from("markets").select("code, name").order("sort"),
  ]);
  const brands = [...new Set((brandRows ?? []).map((b) => b.brand as string))].sort();
  const categories = [...new Set((brandRows ?? []).map((b) => b.category as string | null).filter(Boolean) as string[])].sort();

  const byItem = summariseByItem(rows);
  const byKam = summariseByKam(rows);
  const totalValue = rows.reduce((n, r) => n + r.line_value, 0);
  const totalQty = rows.reduce((n, r) => n + r.qty, 0);
  const orderCount = new Set(rows.map((r) => r.order_number)).size;
  const qs = new URLSearchParams(filters as Record<string, string>).toString();

  return (
    <div className="space-y-6">
      <h1 className="accent-square text-3xl text-brand-black">Reports</h1>

      <form className="bento grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="from">From</label>
          <input id="from" type="date" name="from" defaultValue={filters.from} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="to">To</label>
          <input id="to" type="date" name="to" defaultValue={filters.to} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="market">Market</label>
          <select id="market" name="market" defaultValue={filters.market ?? ""} className="field">
            <option value="">All markets</option>
            {(markets ?? []).map((m) => (
              <option key={m.code} value={m.code}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="kam">KAM</label>
          <select id="kam" name="kam" defaultValue={filters.kam ?? ""} className="field">
            <option value="">Everyone</option>
            {(kams ?? []).map((k) => (
              <option key={k.id} value={k.id}>{k.full_name || k.email}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="account">Account</label>
          <input id="account" name="account" defaultValue={filters.account} placeholder="Name or number" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="brand">Brand</label>
          <select id="brand" name="brand" defaultValue={filters.brand ?? ""} className="field">
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={filters.category ?? ""} className="field">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sku">Item / SKU</label>
          <input id="sku" name="sku" defaultValue={filters.sku} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={filters.status ?? ""} className="field">
            <option value="">All except cancelled</option>
            <option value="submitted">Submitted</option>
            <option value="processing">Processing</option>
            <option value="dispatched">Dispatched</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
          <button className="btn btn-primary">Apply filters</button>
          <a href="/admin/reports" className="btn btn-secondary">Reset</a>
          <span className="ml-auto flex gap-2">
            <a href={`/admin/reports/export?format=xlsx&${qs}`} className="btn btn-secondary">Excel</a>
            <a href={`/admin/reports/export?format=csv&${qs}`} className="btn btn-secondary">CSV</a>
          </span>
        </div>
      </form>

      <div className="grid grid-cols-3 gap-3">
        <div className="bento-green">
          <p className="font-display text-xs uppercase text-white/80">Value</p>
          <p className="font-display text-xl font-medium sm:text-2xl">{money(totalValue)}</p>
        </div>
        <div className="bento">
          <p className="font-display text-xs uppercase">Orders</p>
          <p className="font-display text-xl font-medium text-brand-black sm:text-2xl">{orderCount.toLocaleString()}</p>
        </div>
        <div className="bento">
          <p className="font-display text-xs uppercase">Units</p>
          <p className="font-display text-xl font-medium text-brand-black sm:text-2xl">{totalQty.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="bento overflow-x-auto">
          <h2 className="mb-3 text-xl text-brand-black">By item</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {byItem.slice(0, 100).map((r) => (
                <tr key={r.sku}>
                  <td>
                    <span className="font-medium text-brand-black">{r.name}</span>
                    <span className="block text-xs">{r.brand} · {r.sku}</span>
                  </td>
                  <td className="text-right">{r.orders}</td>
                  <td className="text-right">{r.qty.toLocaleString()}</td>
                  <td className="whitespace-nowrap text-right">{money(r.value)}</td>
                </tr>
              ))}
              {!byItem.length && (
                <tr><td colSpan={4} className="text-sm">No orders match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </section>
        <section className="bento overflow-x-auto">
          <h2 className="mb-3 text-xl text-brand-black">By KAM</h2>
          <table className="table">
            <thead>
              <tr>
                <th>KAM</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {byKam.map((r) => (
                <tr key={r.kam}>
                  <td>{r.kam}</td>
                  <td className="text-right">{r.orders}</td>
                  <td className="whitespace-nowrap text-right">{money(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="bento overflow-x-auto">
        <h2 className="mb-3 text-xl text-brand-black">Order lines</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Date</th>
              <th>KAM</th>
              <th>Account</th>
              <th>Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map((r, i) => (
              <tr key={`${r.order_number}-${r.sku}-${i}`}>
                <td className="whitespace-nowrap">{r.order_number}</td>
                <td className="whitespace-nowrap">{formatDate(r.created_at)}</td>
                <td>{r.kam_name || r.kam_email}</td>
                <td>{r.account_name}</td>
                <td>{r.name}<span className="block text-xs">{r.sku}</span></td>
                <td className="text-right">{r.qty}</td>
                <td className="whitespace-nowrap text-right">{money(r.line_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 300 && <p className="mt-3 text-xs">Showing 300 of {rows.length.toLocaleString()} lines. Download Excel for everything.</p>}
      </section>
    </div>
  );
}
