"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart, type CartContact } from "@/components/CartProvider";
import type { Account, Contact, ParentAccount } from "@/lib/types";
import { UAE_PREFIX, normaliseEmail, normaliseMobile } from "@/lib/contact";
import { MARKETS } from "@/lib/markets";

const ACCOUNT_FIELDS = "id, account_number, name, parent_number, parent_name, kam_name, market, channel";

export function AccountStep() {
  const router = useRouter();
  const cart = useCart();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParentAccount[]>([]);
  const [parent, setParent] = useState<ParentAccount | null>(null);
  const [outlets, setOutlets] = useState<Account[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState<string>("new");
  const blank: CartContact = { name: "", mobile: `${UAE_PREFIX} `, email: "" };
  const [form, setForm] = useState<CartContact>(blank);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; mobile?: string; email?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const account = cart.account;

  // Search parent accounts (RLS limits KAMs to their own market).
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      const supabase = createClient();
      const safe = q.replace(/[%,()]/g, " ");
      const { data } = await supabase
        .from("parent_accounts")
        .select("*")
        .or(`parent_name.ilike.%${safe}%,parent_number.ilike.%${safe}%`)
        .order("parent_name")
        .limit(25);
      setResults((data as ParentAccount[]) ?? []);
      setSearching(false);
    }, 250);
  }, [query]);

  // Load the outlets under the chosen parent account.
  useEffect(() => {
    if (!parent) {
      setOutlets(null);
      return;
    }
    createClient()
      .from("accounts")
      .select(ACCOUNT_FIELDS)
      .eq("parent_number", parent.parent_number)
      .eq("parent_name", parent.parent_name)
      .eq("active", true)
      .order("name")
      .then(({ data }) => setOutlets((data as Account[]) ?? []));
  }, [parent]);

  // Load the outlet's saved contacts and pre-fill the one used on the last order there.
  useEffect(() => {
    if (!account) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("contacts").select("*").eq("account_id", account.id).order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("contact_email")
        .eq("account_id", account.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([{ data }, { data: lastOrder }]) => {
      const list = (data as Contact[]) ?? [];
      setContacts(list);
      setFieldErrors({});
      const current = cart.contact;
      const lastUsed = list.find((c) => c.email === lastOrder?.contact_email) ?? list[0];
      if (current?.id && list.some((c) => c.id === current.id)) {
        setContactId(current.id);
        setForm(current);
      } else if (current && !current.id) {
        setContactId("new");
        setForm(current);
      } else if (lastUsed) {
        setContactId(lastUsed.id);
        setForm(lastUsed);
      } else {
        setContactId("new");
        setForm(blank);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  function pickContact(id: string) {
    setContactId(id);
    const c = contacts.find((x) => x.id === id);
    setForm(c ? { id: c.id, name: c.name, mobile: c.mobile, email: c.email } : blank);
    setFieldErrors({});
  }

  async function proceed(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setError(null);
    const mobile = normaliseMobile(form.mobile);
    const email = normaliseEmail(form.email);
    const errors = {
      name: form.name.trim() ? undefined : "Enter the contact's name.",
      mobile: mobile.ok ? undefined : mobile.error,
      email: email.ok ? undefined : email.error,
    };
    setFieldErrors(errors);
    if (!mobile.ok || !email.ok || errors.name) return;
    const contact = { name: form.name.trim(), mobile: mobile.value, email: email.value };
    setForm((f) => ({ ...f, ...contact }));
    setSaving(true);
    const supabase = createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    let id = contactId !== "new" ? contactId : undefined;

    const existing = contacts.find((c) => c.id === id);
    const changed = !existing || existing.name !== contact.name || existing.mobile !== contact.mobile || existing.email !== contact.email;
    if (changed) {
      // Save for next time. Matching email on the same account updates the existing record.
      const { data, error } = await supabase
        .from("contacts")
        .upsert({ account_id: account.id, ...contact, created_by: userId }, { onConflict: "account_id,email" })
        .select("id")
        .single();
      if (!error && data) id = data.id;
    }
    cart.setContact({ id, ...contact });
    setSaving(false);
    router.push("/shop");
  }

  if (!account && parent) {
    return (
      <div className="mt-6 space-y-4">
        <div className="bento-green flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-xs uppercase tracking-wide text-white/80">Parent account</p>
            <p className="font-display text-lg font-medium uppercase leading-tight">{parent.parent_name}</p>
            <p className="text-sm text-white/85">
              #{parent.parent_number}
              {parent.kam_name ? ` · KAM ${parent.kam_name}` : ""}
            </p>
          </div>
          <button type="button" className="btn bg-white/15 text-white hover:bg-white/25" onClick={() => setParent(null)}>
            Change
          </button>
        </div>
        <div className="bento">
          <h2 className="text-xl text-brand-black">Which outlet should it be delivered to?</h2>
          {outlets === null ? (
            <p className="mt-3 text-sm">Loading outlets…</p>
          ) : outlets.length === 0 ? (
            <p className="mt-3 text-sm">No outlets found for this account.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/5">
              {outlets.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => cart.setAccount(o)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left hover:bg-brand-green-tint"
                  >
                    <span>
                      <span className="block font-medium text-brand-black">{o.name}</span>
                      <span className="text-xs">#{o.account_number}</span>
                    </span>
                    <span aria-hidden className="text-brand-green">→</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="bento mt-6">
        <label htmlFor="account-search" className="label">
          Search parent account name or number
        </label>
        <input
          id="account-search"
          className="field"
          placeholder="e.g. 25 Hours Hotel or 53248"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          autoFocus
        />
        <ul className="mt-3 divide-y divide-black/5">
          {searching && <li className="py-3 text-sm">Searching…</li>}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <li className="py-3 text-sm">No accounts match “{query}”.</li>
          )}
          {results.map((p) => (
            <li key={`${p.parent_number}-${p.parent_name}`}>
              <button
                type="button"
                onClick={() => setParent(p)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left hover:bg-brand-green-tint"
              >
                <span>
                  <span className="block font-medium text-brand-black">{p.parent_name}</span>
                  <span className="text-xs">
                    #{p.parent_number} · {p.outlet_count} {p.outlet_count === 1 ? "outlet" : "outlets"}
                    {p.kam_name ? ` · ${p.kam_name}` : ""}
                  </span>
                </span>
                <span className="badge bg-brand-light">{p.market}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form onSubmit={proceed} noValidate className="mt-6 space-y-4">
      <div className="bento-green flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-base uppercase leading-tight text-white/85">{account.parent_name}</p>
          <p className="mt-0.5 font-display text-lg font-medium uppercase leading-tight">{account.name}</p>
          <p className="text-sm text-white/85">
            Outlet #{account.account_number} · {MARKETS.find((m) => m.code === account.market)?.name ?? account.market}
          </p>
        </div>
        <button
          type="button"
          className="btn bg-white/15 text-white hover:bg-white/25"
          onClick={() => {
            if (cart.lines.length && !confirm("Changing the account empties your cart. Continue?")) return;
            cart.setAccount(null);
            setParent(null);
            setQuery("");
          }}
        >
          Change
        </button>
      </div>

      <div className="bento space-y-4">
        <h2 className="text-xl text-brand-black">Contact at account</h2>
        {contacts.length > 0 && (
          <div>
            <label htmlFor="contact" className="label">
              Contact
            </label>
            <select id="contact" className="field" value={contactId} onChange={(e) => pickContact(e.target.value)}>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.email}
                </option>
              ))}
              <option value="new">+ New contact</option>
            </select>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="c-name" className="label">
              Name
            </label>
            <input
              id="c-name"
              className="field"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoComplete="off"
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-brand-red">{fieldErrors.name}</p>}
          </div>
          <div>
            <label htmlFor="c-mobile" className="label">
              Mobile
            </label>
            <input
              id="c-mobile"
              className="field"
              type="tel"
              inputMode="tel"
              required
              placeholder="+971 50 123 4567"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              onBlur={() => {
                const m = normaliseMobile(form.mobile);
                if (m.ok) setForm((f) => ({ ...f, mobile: m.value }));
                setFieldErrors((fe) => ({ ...fe, mobile: m.ok || form.mobile.trim() === UAE_PREFIX ? undefined : m.error }));
              }}
              aria-invalid={!!fieldErrors.mobile}
              aria-describedby="c-mobile-msg"
              autoComplete="off"
            />
            <p id="c-mobile-msg" className={`mt-1 text-xs ${fieldErrors.mobile ? "text-brand-red" : ""}`}>
              {fieldErrors.mobile ?? "UAE numbers start with +971. For another country, type its + code."}
            </p>
          </div>
          <div>
            <label htmlFor="c-email" className="label">
              Email
            </label>
            <input
              id="c-email"
              className="field"
              type="email"
              inputMode="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => {
                if (!form.email.trim()) return;
                const m = normaliseEmail(form.email);
                setFieldErrors((fe) => ({ ...fe, email: m.ok ? undefined : m.error }));
              }}
              aria-invalid={!!fieldErrors.email}
              autoComplete="off"
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-brand-red">{fieldErrors.email}</p>}
          </div>
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <button className="btn btn-primary w-full sm:w-auto" disabled={saving}>
          {saving ? "Saving…" : "Continue to items →"}
        </button>
      </div>
    </form>
  );
}
