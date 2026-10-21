"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// The items list's filters are remembered for the browser tab, so saving or leaving an item
// returns to the list exactly as it was. Storage can be unavailable (private mode): fall back quietly.
const QUERY_KEY = "posm-admin-items-query";
const SAVED_KEY = "posm-admin-items-saved";

function read(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function itemsListHref() {
  const qs = read(QUERY_KEY);
  return qs ? `/admin/items?${qs}` : "/admin/items";
}

/** Called after a successful save; the list shows a "Saved" notice when it opens. */
export function flagSaved(name: string) {
  write(SAVED_KEY, name);
}

/** On the list page: remembers the current filters and shows the "Saved" notice. */
export function ItemsListMemory() {
  const params = useSearchParams();
  const qs = params.toString();
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => write(QUERY_KEY, qs || null), [qs]);

  useEffect(() => {
    const name = read(SAVED_KEY);
    if (!name) return;
    write(SAVED_KEY, null);
    setSaved(name);
    const t = setTimeout(() => setSaved(null), 2600);
    return () => clearTimeout(t);
  }, []);

  if (!saved) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-brand-green px-5 py-3 text-white shadow-xl animate-[saved-in_.25s_ease-out]"
    >
      <span className="font-display text-lg font-medium uppercase tracking-wide">✓ Saved</span>
      <span className="max-w-[50vw] truncate text-sm text-white/85">{saved}</span>
    </div>
  );
}

/** "← All items" link that goes back to the list with its filters. */
export function BackToItems() {
  const [href, setHref] = useState("/admin/items");
  useEffect(() => setHref(itemsListHref()), []);
  return (
    <Link href={href} className="text-sm underline">
      ← All items
    </Link>
  );
}
