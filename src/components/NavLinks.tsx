"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" || pathname.startsWith("/shop") || pathname.startsWith("/cart") : pathname.startsWith(l.href);
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
