"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; children?: { href: string; label: string }[] };

/** The Commerce Hub sections. POSM Shop and Projects have their own pages underneath. */
export const SECTIONS: NavItem[] = [
  { href: "/", label: "Home" },
  {
    href: "/posm",
    label: "POSM Shop",
    children: [
      { href: "/posm", label: "New order" },
      { href: "/orders", label: "My orders" },
    ],
  },
  {
    href: "/projects",
    label: "Projects",
    children: [
      { href: "/projects", label: "Dashboard" },
      { href: "/projects/new", label: "New project" },
    ],
  },
  { href: "/library", label: "Library" },
];

/** Pages that belong to POSM Shop (where the cart is shown). */
export const isPosmPath = (p: string) => ["/posm", "/shop", "/cart", "/orders"].some((x) => p.startsWith(x));

/** Whether a main section is the current one. */
export function isActiveSection(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/posm") return isPosmPath(pathname);
  return pathname.startsWith(href);
}

/** Whether a page under a section is the current one (exact, so "Dashboard" isn't lit on "New project"). */
export function isActivePage(href: string, pathname: string) {
  if (href === "/posm") return pathname.startsWith("/posm") || pathname.startsWith("/shop") || pathname.startsWith("/cart");
  if (href === "/projects") return pathname === "/projects" || (/^\/projects\/[^/]+$/.test(pathname) && pathname !== "/projects/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {SECTIONS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 font-display text-sm font-medium uppercase tracking-wide transition-colors ${
            isActiveSection(l.href, pathname) ? "bg-brand-green text-white" : "hover:bg-brand-light"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** Thin bar under the header with the current section's pages (e.g. New order · My orders). */
export function SectionNav() {
  const pathname = usePathname();
  const section = SECTIONS.find((s) => s.children && isActiveSection(s.href, pathname));
  if (!section?.children) return null;
  return (
    <div className="no-print border-b border-black/5 bg-white/80">
      <nav className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-1.5 sm:px-6" aria-label={section.label}>
        <span className="mr-2 hidden font-display text-xs uppercase tracking-[0.15em] text-brand-grey sm:inline">{section.label}</span>
        {section.children.map((c) => {
          const active = isActivePage(c.href, pathname);
          return (
            <Link
              key={c.href}
              href={c.href}
              className={`whitespace-nowrap border-b-2 px-2.5 py-1 font-display text-sm font-medium uppercase tracking-wide ${
                active ? "border-brand-green text-brand-black" : "border-transparent text-brand-grey hover:text-brand-black"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Admin, kept apart from the sections: a charcoal button (black while in Admin). */
export function AdminLink({ className = "" }: { className?: string }) {
  const active = usePathname().startsWith("/admin");
  return (
    <Link
      href="/admin"
      className={`flex h-10 items-center gap-1.5 rounded-full px-4 font-display text-sm font-medium uppercase tracking-wide text-white transition-colors ${
        active ? "bg-brand-black" : "bg-brand-grey hover:bg-brand-black"
      } ${className}`}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="10" cy="10" r="2.6" />
        <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" strokeLinecap="round" />
      </svg>
      Admin
    </Link>
  );
}
