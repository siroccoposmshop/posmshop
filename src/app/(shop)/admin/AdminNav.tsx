"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/items", label: "Items" },
  { href: "/admin/import", label: "Excel upload" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/settings", label: "Markets" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="no-print -mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1 border-b border-black/10">
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
      </ul>
    </nav>
  );
}
