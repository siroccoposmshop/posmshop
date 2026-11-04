"use client";

import { useEffect, useRef, useState } from "react";

export type Option = { value: string; label: string; sub?: string };

/**
 * A dropdown of checkboxes for a GET filter form: each ticked option is sent as a repeated
 * `name=value` field. Shows "All …" when nothing is ticked. Searchable when the list is long.
 */
export function MultiSelect({ name, label, allLabel, options, selected }: { name: string; label: string; allLabel: string; options: Option[]; selected: string[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(selected);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const needle = query.trim().toLowerCase();
  const shown = needle ? options.filter((o) => `${o.label} ${o.sub ?? ""}`.toLowerCase().includes(needle)) : options;
  const summary =
    picked.length === 0 ? allLabel : picked.length === 1 ? (options.find((o) => o.value === picked[0])?.label ?? "1 selected") : `${picked.length} selected`;

  return (
    <div ref={ref} className="relative">
      <span className="label">{label}</span>
      {picked.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`field flex items-center justify-between gap-2 text-left ${picked.length ? "text-brand-black" : ""}`}
      >
        <span className="truncate">{summary}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 min-w-56 rounded-xl bg-white p-2 shadow-xl ring-1 ring-black/10">
          {options.length > 8 && (
            <input type="search" className="field mb-2 !py-1.5 text-sm" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          )}
          <div className="flex items-center justify-between px-1 pb-1 text-xs">
            <span>{picked.length ? `${picked.length} selected` : allLabel}</span>
            {picked.length > 0 && (
              <button type="button" className="underline" onClick={() => setPicked([])}>
                Clear
              </button>
            )}
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {shown.map((o) => (
              <li key={o.value}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-brand-light">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand-green)]" checked={picked.includes(o.value)} onChange={() => toggle(o.value)} />
                  <span className="min-w-0">
                    <span className="block truncate text-brand-black">{o.label}</span>
                    {o.sub && <span className="block truncate text-xs">{o.sub}</span>}
                  </span>
                </label>
              </li>
            ))}
            {!shown.length && <li className="px-2 py-1.5 text-sm">No matches.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
