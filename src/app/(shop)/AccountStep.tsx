"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCart, type CartContact } from "@/components/CartProvider";
import type { Account, Contact } from "@/lib/types";

const ACCOUNT_FIELDS = "id, account_number, name, market, channel";

export function AccountStep() {
  const router = useRouter();
  const cart = useCart();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Account[]>([]);
  const [searching, setSearching] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState<string>("new");
  const [form, setForm] = useState<CartContact>({ name: "", mobile: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const account = cart.account;

  // Search accounts (RLS limits KAMs to their own market).
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
        .from("accounts")
        .select(ACCOUNT_FIELDS)
        .or(`name.ilike.%${safe}%,account_number.ilike.%${safe}%`)
        .order("name")
        .limit(20);
      setResults((data as Account[]) ?? []);
      setSearching(false);
    }, 250);
  }, [query]);

  // Load saved contacts for the chosen account.
  useEffect(() => {
    if (!account) return;
    const supabase = createClient();
    supabase
      .from("contacts")
      .select("*")
      .eq("account_id", account.id)
      .order("name")
      .then(({ data }) => {
        const list = (data as Contact[]) ?? [];
        setContacts(list);
        const current = cart.contact;
        if (current?.id && list.some((c) => c.id === current.id)) {
          setContactId(current.id);
          setForm(current);
        } else if (current && !current.id) {
          setContactId("new");
          setForm(current);
        } else if (list.length) {
          setContactId(list[0].id);
          setForm(list[0]);
        } else {
          setContactId("new");
          setForm({ name: "", mobile: "", email: "" });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  function pickContact(id: string) {
    setContactId(id);
    const c = contacts.find((x) => x.id === id);
    setForm(c ? { id: c.id, name: c.name, mobile: c.mobile, email: c.email } : { name: "", mobile: "", email: "" });
  }

  async function proceed(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setError(null);
    const contact = {
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim().toLowerCase(),
    };
    if (!contact.name || !contact.mobile || !/^\S+@\S+\.\S+$/.test(contact.email)) {
      setError("Enter the contact's name, mobile number and a valid email.");
      return;
    }
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

  if (!account) {
    return (
      <div className="bento mt-6">
        <label htmlFor="account-search" className="label">
          Search account name or number
        </label>
        <input
          id="account-search"
          className="field"
          placeholder="e.g. Hard Rock Café or 100234"
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
          {results.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => cart.setAccount(a)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left hover:bg-brand-green-tint"
              >
                <span>
                  <span className="block font-medium text-brand-black">{a.name}</span>
                  <span className="text-xs">
                    #{a.account_number}
                    {a.channel ? ` · ${a.channel}` : ""}
                  </span>
                </span>
                <span className="badge bg-brand-light">{a.market}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form onSubmit={proceed} className="mt-6 space-y-4">
      <div className="bento-green flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-xs uppercase tracking-wide text-white/80">Account</p>
          <p className="font-display text-2xl font-medium uppercase">{account.name}</p>
          <p className="text-sm text-white/85">
            #{account.account_number} · {account.market}
          </p>
        </div>
        <button
          type="button"
          className="btn bg-white/15 text-white hover:bg-white/25"
          onClick={() => {
            if (cart.lines.length && !confirm("Changing the account empties your cart. Continue?")) return;
            cart.setAccount(null);
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
              placeholder="+971 50 000 0000"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="c-email" className="label">
              Email
            </label>
            <input
              id="c-email"
              className="field"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="off"
            />
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
