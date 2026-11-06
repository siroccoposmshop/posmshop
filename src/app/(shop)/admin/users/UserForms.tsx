"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Profile } from "@/lib/types";
import { HUB_ROLES, hubRoleShort } from "@/lib/hub";
import { formatDate } from "@/lib/format";
import { inviteUser, saveUser } from "../actions";

export type MarketOption = { code: string; name: string };

/** One user: name, email, access, hub role and last seen; open it to edit everything else. */
export function UserRow({ user, markets, managers }: { user: Profile; markets: MarketOption[]; managers: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(saveUser, null);
  const [open, setOpen] = useState(false);
  const isAdmin = user.role === "admin" || user.hub_role === "tm" || user.hub_role === "tmm";
  const userMarkets = user.markets?.length ? user.markets : user.market ? [user.market] : [];
  return (
    <li className={user.active ? "" : "opacity-60"}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_6rem_5rem_9rem_1.5rem] items-center gap-3 px-4 py-3 text-left hover:bg-brand-light/60"
      >
        <span className="truncate font-medium text-brand-black">{user.full_name || user.email.split("@")[0]}</span>
        <span className="truncate text-sm">{user.email}</span>
        <span>
          <span className={`badge ${isAdmin ? "bg-brand-black text-white" : "bg-brand-light text-brand-grey"}`}>{isAdmin ? "Admin" : "User"}</span>
        </span>
        <span className="font-display text-sm uppercase text-brand-black">{hubRoleShort(user.hub_role)}</span>
        <span className="whitespace-nowrap text-xs">
          {user.active ? (user.last_seen_at ? formatDate(user.last_seen_at, true) : "Never") : "Inactive"}
        </span>
        <svg viewBox="0 0 20 20" className={`h-5 w-5 text-brand-green transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <form action={action} className="space-y-4 border-t border-black/5 bg-brand-light/40 px-4 py-4">
          <input type="hidden" name="id" value={user.id} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label" htmlFor={`n-${user.id}`}>Name</label>
              <input id={`n-${user.id}`} name="full_name" defaultValue={user.full_name ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor={`a-${user.id}`}>Access</label>
              <select id={`a-${user.id}`} name="role" defaultValue={user.role} className="field" title={user.hub_role === "tm" || user.hub_role === "tmm" ? "TM and TMM are always admins" : undefined}>
                <option value="kam">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`h-${user.id}`}>Hub role</label>
              <select id={`h-${user.id}`} name="hub_role" defaultValue={user.hub_role ?? "kam"} className="field">
                {HUB_ROLES.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.short} · {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`r-${user.id}`}>Reports to</label>
              <select id={`r-${user.id}`} name="manager_id" defaultValue={user.manager_id ?? ""} className="field">
                <option value="">—</option>
                {managers
                  .filter((m) => m.id !== user.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <span className="label">Trade</span>
              <TradePicker value={user.trade ?? ["on"]} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <span className="label">Markets</span>
              <MarketPicker options={markets} value={userMarkets} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-brand-black">
              <input type="checkbox" name="active" defaultChecked={user.active} className="h-5 w-5 accent-[var(--color-brand-green)]" />
              Active (can sign in)
            </label>
            <button className="btn btn-primary !px-5 !py-1.5 text-sm" disabled={pending}>
              {pending ? "Saving…" : state?.ok ? "Saved ✓" : "Save"}
            </button>
            <button type="button" className="text-sm underline" onClick={() => setOpen(false)}>
              Close
            </button>
            {state?.error && <span className="text-sm text-brand-red">{state.error}</span>}
          </div>
        </form>
      )}
    </li>
  );
}

export function InviteForm({ markets }: { markets: MarketOption[] }) {
  const [state, action, pending] = useActionState(inviteUser, null);
  return (
    <form action={action} className="bento space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="inv-email">Email</label>
          <input id="inv-email" name="email" type="email" required placeholder="name@sirocco.ae" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="inv-name">Name</label>
          <input id="inv-name" name="full_name" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="inv-role">Access</label>
          <select id="inv-role" name="role" className="field">
            <option value="kam">User</option>
            <option value="admin">Admin (Trade Marketing)</option>
          </select>
        </div>
        <div>
          <span className="label">Trade</span>
          <TradePicker value={["on"]} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <span className="label">Markets</span>
          <MarketPicker options={markets} value={[]} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
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

/** Tick any number of markets; each is sent as "markets". */
function MarketPicker({ options, value }: { options: MarketOption[]; value: string[] }) {
  const [picked, setPicked] = useState<string[]>(value);
  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  return (
    <div className="flex flex-wrap gap-2">
      {picked.map((c) => (
        <input key={c} type="hidden" name="markets" value={c} />
      ))}
      {options.map((m) => {
        const on = picked.includes(m.code);
        return (
          <button
            key={m.code}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(m.code)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 transition ${
              on ? "bg-brand-green text-white ring-brand-green" : "bg-white text-brand-black ring-black/15 hover:ring-brand-green"
            }`}
          >
            <span aria-hidden>{on ? "✓" : "+"}</span>
            {m.name}
          </button>
        );
      })}
      {!picked.length && <span className="self-center text-xs">None yet: they&apos;ll see no POSM outlets until one is ticked.</span>}
    </div>
  );
}

const TRADES = [
  { value: "on", label: "On trade" },
  { value: "off", label: "Off trade" },
] as const;

/**
 * On trade / Off trade: a dropdown with a tick box for each, so someone can be on one or both.
 * Sends each ticked one as "trade".
 */
function TradePicker({ value }: { value: string[] }) {
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
        <input key={v} type="hidden" name="trade" value={v} />
      ))}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Trade"
        className="field flex items-center justify-between gap-2 text-left"
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
