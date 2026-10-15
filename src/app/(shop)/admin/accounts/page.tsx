import { MARKETS } from "@/lib/markets";
import { LiveFilters } from "@/components/LiveFilters";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Account } from "@/lib/types";

export const metadata = { title: "Accounts" };
export const dynamic = "force-dynamic";

export default async function AdminAccounts({ searchParams }: { searchParams: Promise<{ q?: string; market?: string }> }) {
  const sp = await searchParams;
  const db = createAdminClient();
  let q = db.from("accounts").select("*, contacts(count)", { count: "exact" }).order("parent_name").order("name").limit(500);
  if (sp.market) q = q.eq("market", sp.market);
  if (sp.q) {
    const s = sp.q.replace(/[%,()]/g, " ");
    q = q.or(`name.ilike.%${s}%,account_number.ilike.%${s}%,parent_name.ilike.%${s}%,kam_name.ilike.%${s}%`);
  }
  const { data, count } = await q;
  const accounts = (data ?? []) as (Account & { active: boolean; contacts: { count: number }[] })[];

  return (
    <div>
      <h1 className="accent-square text-3xl text-brand-black">Accounts &amp; outlets</h1>
      <p className="mt-2 text-sm">Outlets come from the CUSTOMER LIST tab of the budgeting Excel, grouped by parent account (first 5 digits of the account number). Upload a new file to add or update them.</p>
      <LiveFilters className="mt-4 grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
        <input name="q" type="search" autoComplete="off" defaultValue={sp.q} placeholder="Parent, outlet, number or KAM" className="field" />
        <select name="market" defaultValue={sp.market ?? ""} className="field">
          <option value="">All markets</option>
          {MARKETS.map((m) => (
            <option key={m.code} value={m.code}>
              {m.name}
            </option>
          ))}
        </select>
      </LiveFilters>
      <p className="mt-3 text-sm">{(count ?? 0).toLocaleString()} outlets{(count ?? 0) > 500 ? " (showing 500)" : ""}</p>
      <div className="bento mt-2 overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Parent account</th>
              <th>Outlet</th>
              <th>Outlet number</th>
              <th>KAM</th>
              <th>Market</th>
              <th className="text-right">Contacts</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.parent_name}
                  <span className="block text-xs">#{a.parent_number}</span>
                </td>
                <td className="text-brand-black">{a.name}</td>
                <td className="whitespace-nowrap">{a.account_number}</td>
                <td>{a.kam_name}</td>
                <td>{a.market}</td>
                <td className="text-right">{a.contacts?.[0]?.count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
