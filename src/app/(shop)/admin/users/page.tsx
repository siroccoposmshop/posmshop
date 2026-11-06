import { createAdminClient } from "@/lib/supabase/admin";
import type { Market, Profile } from "@/lib/types";
import { OFF_TRADE_MARKETS } from "@/lib/off-trade";
import { InviteForm, UserRow } from "./UserForms";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const db = createAdminClient();
  const [{ data: users }, { data: markets }] = await Promise.all([
    db.from("profiles").select("*").order("role").order("email"),
    db.from("markets").select("*").order("sort"),
  ]);
  const managers = ((users as Profile[]) ?? [])
    .filter((u) => ["sm", "cm", "tmm"].includes(u.hub_role ?? ""))
    .map((u) => ({ id: u.id, name: u.full_name || u.email.split("@")[0] }));
  // POSM markets plus the other Gulf markets (more come with the company-code table).
  const posm = ((markets as Market[]) ?? []).map((m) => ({ code: m.code, name: m.name }));
  const marketOptions = [...posm, ...Object.entries(OFF_TRADE_MARKETS).filter(([c]) => !posm.some((m) => m.code === c)).map(([code, name]) => ({ code, name }))];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="accent-square text-3xl text-brand-black">Users</h1>
        <p className="mt-2 max-w-3xl text-sm">
          Anyone with an @sirocco.ae email can sign in. New sign-ins are KAMs with no market until you tick
          one. Add people here in advance to set their markets and role before they first sign in.
          <br />
          <strong>Access</strong>: Admin opens the Admin menu (every tool, plus Users, Accounts and Markets). TM and TMM are always
          admins. <strong>Hub role</strong> (KAM, SM, CM, TM, TMM) sets what people see: KAMs their own projects and POSM reports,
          SMs their team&apos;s (and they approve), CM everything. Set <strong>Reports to</strong> on each KAM to link them to their
          Sales Manager.
        </p>
      </div>
      <InviteForm markets={marketOptions} />
      <section className="bento !p-0">
        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_6rem_5rem_9rem_1.5rem] gap-3 border-b-2 border-brand-green px-4 py-2 font-display text-xs uppercase tracking-wide">
          <span>Name</span>
          <span>Email</span>
          <span>Access</span>
          <span>Role</span>
          <span>Last seen</span>
          <span />
        </div>
        <ul className="divide-y divide-black/5">
          {((users as Profile[]) ?? []).map((u) => (
            <UserRow key={u.id} user={u} markets={marketOptions} managers={managers} />
          ))}
        </ul>
      </section>
    </div>
  );
}
