"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_MENU, adminEntryFor } from "@/components/NavLinks";

/**
 * Tabs for the current part of Admin: POSM Shop's own pages (plus Upload), or the Hub-wide pages
 * (Users · Accounts · Markets). The Admin menu in the header switches between parts.
 */
export function AdminNav() {
  const path = usePathname();
  const entry = adminEntryFor(path);
  const hubWide = ADMIN_MENU[1].items;
  const isHubWide = !!entry && hubWide.some((i) => i.href === entry.href);
  const tabs = entry?.tabs ?? (isHubWide ? hubWide : []);
  const isPosm = entry?.href === "/admin";

  return (
    <nav className="no-print -mx-4 overflow-x-auto px-4">
      <p className="font-display text-xs uppercase tracking-[0.15em] text-brand-grey">
        Admin · {isHubWide ? "Across the Hub" : (entry?.label ?? "")}
      </p>
      {tabs.length > 0 && (
        <ul className="mt-1 flex items-center gap-1 border-b border-black/10">
          {tabs.map((l) => {
            const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`block whitespace-nowrap border-b-[3px] px-3 py-2 font-display text-sm font-medium uppercase tracking-wide ${
                    active ? "border-brand-green text-brand-black" : "border-transparent hover:text-brand-black"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
          {/* Upload is a different kind of task from the pages above, so it sits apart as a button. */}
          {isPosm && (
            <li className="ml-auto pb-1 pl-3">
              <Link
                href="/admin/import"
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 font-display text-sm font-medium uppercase tracking-wide text-white transition-colors ${
                  path.startsWith("/admin/import") ? "bg-brand-black" : "bg-brand-grey hover:bg-brand-black"
                }`}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10 13V3M6 7l4-4 4 4M4 13v3h12v-3" />
                </svg>
                Upload
              </Link>
            </li>
          )}
        </ul>
      )}
    </nav>
  );
}
