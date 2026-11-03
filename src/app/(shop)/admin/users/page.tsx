import { createAdminClient } from "@/lib/supabase/admin";
import type { Market, Profile } from "@/lib/types";
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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="accent-square text-3xl text-brand-black">Users</h1>
        <p className="mt-2 max-w-3xl text-sm">
          Anyone with an @sirocco.ae email can sign in. New sign-ins are KAMs with no market until you assign
          one. Add people here in advance to set their market and role before they first sign in.
          <br />
          <strong>POSM role</strong> controls POSM Shop admin. <strong>Hub role</strong> (KAM, SM, CM, TM, TMM) controls Projects:
          SMs approve and see their team; CM, TM and TMM see everything and run projects. Set <strong>Reports to</strong> on each KAM to
          link them to their Sales Manager.
        </p>
      </div>
      <InviteForm markets={(markets as Market[]) ?? []} />
      <div className="bento overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th title="POSM Shop access">POSM role</th>
              <th>Hub role</th>
              <th>Reports to</th>
              <th>Market</th>
              <th>Last seen</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {((users as Profile[]) ?? []).map((u) => (
              <UserRow key={u.id} user={u} markets={(markets as Market[]) ?? []} managers={managers} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
