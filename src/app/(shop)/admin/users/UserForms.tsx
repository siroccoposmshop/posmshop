"use client";

import { useActionState } from "react";
import type { Market, Profile } from "@/lib/types";
import { inviteUser, saveUser } from "../actions";

export function UserRow({ user, markets }: { user: Profile; markets: Market[] }) {
  const [state, action, pending] = useActionState(saveUser, null);
  const formId = `user-${user.id}`;
  return (
    <tr>
      <td className="text-brand-black">
        {user.email}
        <form id={formId} action={action}>
          <input type="hidden" name="id" value={user.id} />
        </form>
        {state?.error && <span className="block text-xs text-brand-red">{state.error}</span>}
      </td>
      <td>
        <input form={formId} name="full_name" defaultValue={user.full_name ?? ""} className="field !py-1.5 text-sm" aria-label="Name" />
      </td>
      <td>
        <select form={formId} name="role" defaultValue={user.role} className="field !py-1.5 text-sm" aria-label="Role">
          <option value="kam">KAM</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td>
        <select form={formId} name="market" defaultValue={user.market ?? ""} className="field !py-1.5 text-sm" aria-label="Market">
          <option value="">None</option>
          {markets.map((m) => (
            <option key={m.code} value={m.code}>
              {m.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input form={formId} type="checkbox" name="active" defaultChecked={user.active} className="h-5 w-5 accent-[var(--color-brand-green)]" aria-label="Active" />
      </td>
      <td>
        <button form={formId} className="btn btn-secondary !px-3 !py-1.5 text-xs" disabled={pending}>
          {pending ? "…" : state?.ok ? "Saved ✓" : "Save"}
        </button>
      </td>
    </tr>
  );
}

export function InviteForm({ markets }: { markets: Market[] }) {
  const [state, action, pending] = useActionState(inviteUser, null);
  return (
    <form action={action} className="bento grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <label className="label" htmlFor="inv-email">Email</label>
        <input id="inv-email" name="email" type="email" required placeholder="name@sirocco.ae" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="inv-name">Name</label>
        <input id="inv-name" name="full_name" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="inv-role">Role</label>
        <select id="inv-role" name="role" className="field">
          <option value="kam">KAM</option>
          <option value="admin">Admin (Trade Marketing)</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="inv-market">Market</label>
        <select id="inv-market" name="market" className="field">
          <option value="">None</option>
          {markets.map((m) => (
            <option key={m.code} value={m.code}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-5">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Adding…" : "Add user"}
        </button>
        {state?.error && <span className="text-sm text-brand-red">{state.error}</span>}
        {state?.ok && <span className="text-sm text-brand-green">Added. They can now sign in with their email.</span>}
      </div>
    </form>
  );
}
