"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * A filter bar that updates the list as you type or pick from a dropdown.
 * Text inputs wait 300ms after the last keystroke; selects apply immediately.
 * Renders a "Clear filters" button (pass it as `clearButton` placement via children order).
 */
export function LiveFilters({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function apply() {
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) {
      if (typeof v === "string" && v.trim()) params.set(k, v.trim());
    }
    const qs = params.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function onInput(e: React.FormEvent<HTMLFormElement>) {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    if (timer.current) clearTimeout(timer.current);
    if (el.tagName === "SELECT") apply();
    else timer.current = setTimeout(apply, 300);
  }

  function clear() {
    const form = formRef.current;
    if (!form) return;
    for (const el of Array.from(form.elements)) {
      if (el instanceof HTMLInputElement) el.value = "";
      if (el instanceof HTMLSelectElement) el.selectedIndex = 0;
    }
    if (timer.current) clearTimeout(timer.current);
    start(() => router.replace(pathname, { scroll: false }));
  }

  return (
    <form
      ref={formRef}
      className={className}
      onInput={onInput}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      role="search"
      aria-busy={pending}
    >
      {children}
      <button type="button" onClick={clear} className="btn btn-secondary whitespace-nowrap !px-4">
        {pending ? "Loading…" : "Clear filters"}
      </button>
    </form>
  );
}
