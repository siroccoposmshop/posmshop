"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Home only on its own page; POSM Shop also covers the items and cart pages. */
export function isActiveLink(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/posm") return pathname.startsWith("/posm") || pathname.startsWith("/shop") || pathname.startsWith("/cart");
  return pathname.startsWith(href);
}

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {links.map((l) => {
        const active = isActiveLink(l.href, pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 font-display text-sm font-medium uppercase tracking-wide transition-colors ${
              active ? "bg-brand-green text-white" : "hover:bg-brand-light"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
