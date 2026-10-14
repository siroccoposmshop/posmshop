import { createAdminClient } from "@/lib/supabase/admin";
import type { Account } from "@/lib/types";

export const metadata = { title: "Accounts" };
export const dynamic = "force-dynamic";

export default async function AdminAccounts({ searchParams }: { searchParams: Promise<{ q?: string; market?: string }> }) {
  const sp = await searchParams;
  const db = createAdminClient();
  let q = db.from("accounts").select("*, contacts(count)", { count: "exact" }).order("name").limit(500);
  if (sp.market) q = q.eq("market", sp.market);
  if (sp.q) {
    const s = sp.q.replace(/[%,()]/g, " ");
    q = q.or(`name.ilike.%${s}%,account_number.ilike.%${s}%`);
  }
  const { data, count } = await q;
  const accounts = (data ?? []) as (Account & { active: boolean; next_order_seq: number; contacts: { count: number }[] })[];

  return (
    <div>
      <h1 className="accent-square text-3xl text-brand-black">Accounts</h1>
      <p className="mt-2 text-sm">Accounts come from the budgeting Excel. Upload a new file to add or update them.</p>
      <form className="mt-4 grid gap-2 sm:grid-cols-4">
        <input name="q" defaultValue={sp.q} placeholder="Name or number" className="field sm:col-span-2" />
        <select name="market" defaultValue={sp.market ?? ""} className="field">
          <option value="">All markets</option>
          <option value="UAE">UAE</option>
          <option value="OMN">Oman</option>
          <option value="QAT">Qatar</option>
          <option value="BHR">Bahrain</option>
        </select>
        <button className="btn btn-secondary">Search</button>
      </form>
      <p className="mt-3 text-sm">{(count ?? 0).toLocaleString()} accounts{(count ?? 0) > 500 ? " (showing 500)" : ""}</p>
      <div className="bento mt-2 overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Name</th>
              <th>Market</th>
              <th>Channel</th>
              <th className="text-right">Contacts</th>
              <th>Next order #</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.account_number}</td>
                <td className="text-brand-black">{a.name}</td>
                <td>{a.market}</td>
                <td>{a.channel}</td>
                <td className="text-right">{a.contacts?.[0]?.count ?? 0}</td>
                <td className="whitespace-nowrap text-xs">POSM-{a.account_number}-{a.next_order_seq}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
