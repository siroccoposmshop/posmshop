"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Market, Profile } from "@/lib/types";
import { HUB_ROLES } from "@/lib/hub";
import { formatDate } from "@/lib/format";
import { inviteUser, saveUser } from "../actions";

export function UserRow({ user, markets, managers }: { user: Profile; markets: Market[]; managers: { id: string; name: string }[] }) {
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
        <input form={formId} name="full_name" defaultValue={user.full_name ?? ""} className="field min-w-[9rem] !py-1.5 text-sm" aria-label="Name" />
      </td>
      <td>
        <select
          form={formId}
          name="role"
          defaultValue={user.role}
          className="field min-w-[6.5rem] !py-1.5 text-sm"
          aria-label="Access"
          title={user.hub_role === "tm" || user.hub_role === "tmm" ? "TM and TMM are always admins" : undefined}
        >
          <option value="kam">User</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td>
        <select form={formId} name="hub_role" defaultValue={user.hub_role ?? "kam"} className="field min-w-[5.5rem] !py-1.5 text-sm" aria-label="Hub role">
          {HUB_ROLES.map((r) => (
            <option key={r.code} value={r.code}>
              {r.short}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select form={formId} name="manager_id" defaultValue={user.manager_id ?? ""} className="field min-w-[8rem] !py-1.5 text-sm" aria-label="Reports to">
          <option value="">—</option>
          {managers
            .filter((m) => m.id !== user.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
      </td>
      <td>
        <TradePicker formId={formId} value={user.trade ?? ["on"]} />
      </td>
      <td>
        <select form={formId} name="market" defaultValue={user.market ?? ""} className="field min-w-[8rem] !py-1.5 text-sm" aria-label="Market">
          <option value="">None</option>
          {markets.map((m) => (
            <option key={m.code} value={m.code}>
              {m.name}
            </option>
          ))}
        </select>
      </td>
      <td className="whitespace-nowrap text-xs">{user.last_seen_at ? formatDate(user.last_seen_at, true) : "Never"}</td>
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
    <form action={action} className="bento grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
        <span className="label">Trade</span>
        <TradePicker value={["on"]} />
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 sm:col-span-2 lg:col-span-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="send_invite" defaultChecked className="h-5 w-5 accent-[var(--color-brand-green)]" />
          Email an invite
        </label>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Adding…" : "Add user"}
        </button>
        {state?.error && <span className="text-sm text-brand-red">{state.error}</span>}
        {state?.ok && (
          <span className="text-sm text-brand-green">
            {state.invited ? "Added and invite emailed." : "Added. They can now sign in with their email."}
          </span>
        )}
      </div>
    </form>
  );
}

const TRADES = [
  { value: "on", label: "On trade" },
  { value: "off", label: "Off trade" },
] as const;

/**
 * On trade / Off trade: a dropdown with a tick box for each, so someone can be on one or both.
 * Sends each ticked one as "trade" (with form= for the rows, whose inputs sit outside their form).
 */
function TradePicker({ value, formId }: { value: string[]; formId?: string }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(value.length ? value : ["on"]);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The list floats above the page (in <body>), so the users table's scroll area can't cut it off.
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 176) });
    };
    place();
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node) && setOpen(false);
    const shut = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", shut);
    window.addEventListener("scroll", shut, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", shut);
      window.removeEventListener("scroll", shut, true);
    };
  }, [open]);
  const label = picked.length === 2 ? "On + off trade" : picked[0] === "off" ? "Off trade" : "On trade";
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? (p.length > 1 ? p.filter((x) => x !== v) : p) : [...p, v]));
  return (
    <div ref={ref} className="relative min-w-[9rem]">
      {picked.map((v) => (
        <input key={v} type="hidden" name="trade" value={v} form={formId} />
      ))}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Trade"
        className={`field flex items-center justify-between gap-2 text-left ${formId ? "!py-1.5 text-sm" : ""}`}
      >
        <span className="truncate text-brand-black">{label}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && pos && createPortal(
        <div ref={panelRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }} className="z-50 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-black/10">
          {TRADES.map((t) => (
            <label key={t.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-brand-black hover:bg-brand-light">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand-green)]" checked={picked.includes(t.value)} onChange={() => toggle(t.value)} />
              {t.label}
            </label>
          ))}
          <p className="px-2 pt-1 text-xs">Tick both for someone on both.</p>
        </div>,
        document.body,
      )}
    </div>
  );
}
