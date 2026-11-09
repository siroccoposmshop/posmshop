"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { addOffTradeProject } from "../actions";

export type StoreOption = { id: string; name: string; detail: string; search?: string };

const CATEGORIES: { value: string; label: string }[] = [
  { value: "Branding", label: "Branding" },
  { value: "Perfect shelf", label: "Perfect shelf" },
  { value: "Fridge", label: "Fridge" },
  { value: "FSU", label: "FSU" },
  { value: "Takeover", label: "Takeover" },
  { value: "Cold room", label: "Cold room activation" },
  { value: "Other", label: "Other" },
];

const today = () => new Date().toISOString().slice(0, 10);
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Store picker you can type into: matches every word against the name, chain, area and TM. */
function StorePicker({ stores, value, onChange }: { stores: StoreOption[]; value: StoreOption | null; onChange: (s: StoreOption | null) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const hits = useMemo(() => {
    const ws = words(q).split(" ").filter(Boolean);
    const all = ws.length ? stores.filter((s) => ws.every((w) => words(`${s.search ?? s.name} ${s.detail}`).includes(w))) : stores;
    return all.slice(0, 50);
  }, [q, stores]);

  if (value)
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-green-tint px-3 py-2">
        <div>
          <p className="font-medium text-brand-black">{value.name}</p>
          <p className="text-xs">{value.detail}</p>
        </div>
        <button type="button" className="text-sm underline" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );

  const pick = (s: StoreOption) => {
    onChange(s);
    setQ("");
    setOpen(false);
  };
  return (
    <div className="relative">
      <input
        className="field"
        placeholder="Type a store, chain, area or TM…"
        value={q}
        role="combobox"
        aria-expanded={open}
        aria-controls="store-options"
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && hits[active]) {
            e.preventDefault();
            pick(hits[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul id="store-options" ref={list} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/10">
          {hits.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 ${i === active ? "bg-brand-green-tint" : ""}`}
            >
              <p className="text-sm font-medium text-brand-black">{s.name}</p>
              <p className="text-xs">{s.detail}</p>
            </li>
          ))}
          {!hits.length && <li className="px-3 py-2 text-sm">No store matches &ldquo;{q}&rdquo;.</li>}
        </ul>
      )}
    </div>
  );
}

export function AddProjectForm({ stores, initialStore }: { stores: StoreOption[]; initialStore: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [store, setStore] = useState<StoreOption | null>(stores.find((s) => s.id === initialStore) ?? null);
  const [type, setType] = useState("");
  const [item, setItem] = useState("");
  const [brand, setBrand] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ store: StoreOption; what: string }[]>([]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return setError("Choose the store.");
    if (!type) return setError("Choose the category.");
    if (!date) return setError("Enter the date it was done.");
    start(async () => {
      setError(null);
      const res = await addOffTradeProject(store.id, {
        type,
        status: "completed",
        planYear: null,
        plannedDate: null,
        completedDate: date,
        expectedCost: null,
        actualCost: cost,
        notes,
        item,
        brand,
        quantity,
      });
      if (res.error) return setError(res.error);
      const label = CATEGORIES.find((c) => c.value === type)?.label ?? type;
      setSaved((x) => [{ store, what: `${Number(quantity) > 1 ? `${quantity} × ` : ""}${label}${item ? ` (${item})` : ""} · ${date}` }, ...x].slice(0, 8));
      // Ready for the next one: same store and date, the rest cleared.
      setType("");
      setItem("");
      setBrand("");
      setQuantity("1");
      setCost("");
      setNotes("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="bento space-y-4">
        <div className="space-y-1">
          <span className="label">Store *</span>
          <StorePicker stores={stores} value={store} onChange={setStore} />
        </div>
        <div className="space-y-1">
          <span className="label">Category *</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={type === c.value}
                onClick={() => setType(c.value)}
                className={`rounded-full px-3 py-1.5 text-sm ring-1 ${type === c.value ? "bg-brand-green text-white ring-brand-green" : "bg-white text-brand-black ring-black/15 hover:ring-brand-green"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {type === "Cold room" && <p className="text-xs">Saving this marks the store as having a cold room, activated on this date.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="label">Date done *</span>
            <input type="date" className="field" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="label">Cost (AED)</span>
            <input inputMode="decimal" className="field" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 4500" />
          </label>
          <label className="space-y-1">
            <span className="label">What exactly</span>
            <input className="field" value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Wall branding, 2-door fridge" />
          </label>
          <label className="space-y-1">
            <span className="label">Brand</span>
            <input className="field" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Heineken" />
          </label>
          <label className="space-y-1">
            <span className="label">Quantity</span>
            <input type="number" min={1} className="field" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="label">Notes</span>
            <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <button className="btn btn-primary" disabled={pending}>
          {pending && <Spinner />} {pending ? "Saving…" : "Save project"}
        </button>
      </form>

      {saved.length > 0 && (
        <section className="bento space-y-2">
          <h2 className="font-display text-sm uppercase tracking-wide text-brand-black">Saved just now</h2>
          <ul className="space-y-1 text-sm">
            {saved.map((x, i) => (
              <li key={i}>
                ✓{" "}
                <Link href={`/off-trade/stores/${x.store.id}`} className="font-medium text-brand-black underline">
                  {x.store.name}
                </Link>{" "}
                · {x.what}
              </li>
            ))}
          </ul>
          <p className="text-xs">The store and date stay filled in, so you can add the next item. Change the store when you move on.</p>
        </section>
      )}
    </div>
  );
}
