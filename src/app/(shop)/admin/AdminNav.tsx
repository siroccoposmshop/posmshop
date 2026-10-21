"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/items", label: "Items" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/settings", label: "Markets" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="no-print -mx-4 overflow-x-auto px-4">
      <ul className="flex items-center gap-1 border-b border-black/10">
        {links.map((l) => {
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
      </ul>
    </nav>
  );
}
