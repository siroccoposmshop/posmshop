"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type NavItem = { href: string; label: string; adminOnly?: boolean; children?: { href: string; label: string; managers?: boolean }[] };

/** The Commerce Hub sections. POSM Shop and Projects have their own pages underneath. */
export const SECTIONS: NavItem[] = [
  { href: "/", label: "Home" },
  {
    href: "/posm",
    label: "POSM Shop",
    children: [
      { href: "/posm", label: "New order" },
      { href: "/orders", label: "My orders" },
      { href: "/reports", label: "Reports" },
    ],
  },
  {
    href: "/projects",
    label: "Projects",
    children: [
      { href: "/projects", label: "Dashboard" },
      { href: "/projects/new", label: "New project" },
      // Only for SMs, CM, TM, TMM and admins.
      { href: "/projects/reports", label: "Reports", managers: true },
    ],
  },
  // Trade Marketing (TM, TMM) and admins only.
  {
    href: "/off-trade",
    label: "Off trade",
    adminOnly: true,
    children: [
      { href: "/off-trade", label: "Dashboard" },
      { href: "/off-trade/import", label: "Upload stores" },
    ],
  },
  { href: "/library", label: "Library" },
];

/** Pages that belong to POSM Shop (where the cart is shown). */
export const isPosmPath = (p: string) => ["/posm", "/shop", "/cart", "/orders", "/reports"].some((x) => p.startsWith(x));

/** Whether a main section is the current one. */
export function isActiveSection(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/posm") return isPosmPath(pathname);
  return pathname.startsWith(href);
}

/** Whether a page under a section is the current one (exact, so "Dashboard" isn't lit on "New project"). */
export function isActivePage(href: string, pathname: string) {
  if (href === "/posm") return pathname.startsWith("/posm") || pathname.startsWith("/shop") || pathname.startsWith("/cart");
  if (href === "/off-trade") return pathname === "/off-trade" || pathname.startsWith("/off-trade/stores");
  if (href === "/projects") return pathname === "/projects" || (/^\/projects\/[^/]+$/.test(pathname) && pathname !== "/projects/new" && pathname !== "/projects/reports");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {SECTIONS.filter((s) => admin || !s.adminOnly).map((l) => (
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
/** The sections for this person (manager-only pages left out for KAMs). */
export const sectionsFor = (managers: boolean, admin = false) =>
  SECTIONS.filter((s) => admin || !s.adminOnly).map((s) => ({ ...s, children: s.children?.filter((c) => managers || !c.managers) }));

export function SectionNav({ managers = false, admin = false }: { managers?: boolean; admin?: boolean }) {
  const pathname = usePathname();
  const section = sectionsFor(managers, admin).find((s) => s.children && isActiveSection(s.href, pathname));
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

/**
 * Admin, by tool and then Hub-wide. Each tool's admin has its own pages (tabs); the Hub-wide
 * pages apply to every tool.
 */
export const ADMIN_MENU: { title: string; items: { href: string; label: string; tabs?: { href: string; label: string }[] }[] }[] = [
  {
    title: "Tools",
    items: [
      {
        href: "/admin",
        label: "POSM Shop",
        tabs: [
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/orders", label: "Orders" },
          { href: "/admin/items", label: "Items" },
        ],
      },
      { href: "/admin/projects", label: "Projects" },
      { href: "/admin/library", label: "Marketing Library" },
    ],
  },
  {
    title: "Across the Hub",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/accounts", label: "Accounts" },
      { href: "/admin/settings", label: "Markets" },
    ],
  },
];

const POSM_ADMIN = ["/admin/orders", "/admin/items", "/admin/import"];

/** Which Admin menu entry a page belongs to (POSM Shop's admin includes its sub-pages and Upload). */
export function adminEntryFor(pathname: string) {
  const all = ADMIN_MENU.flatMap((g) => g.items);
  if (pathname === "/admin" || POSM_ADMIN.some((x) => pathname.startsWith(x))) return all[0];
  return all.find((i) => i.href !== "/admin" && pathname.startsWith(i.href)) ?? null;
}

const GEAR = (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <circle cx="10" cy="10" r="2.6" />
    <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" strokeLinecap="round" />
  </svg>
);

/** The Admin button in the header: opens a small menu of each tool's admin, then the Hub-wide pages. */
export function AdminLink({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const active = pathname.startsWith("/admin");
  const current = adminEntryFor(pathname);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
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

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-10 items-center gap-1.5 rounded-full px-4 font-display text-sm font-medium uppercase tracking-wide text-white transition-colors ${
          active || open ? "bg-brand-black" : "bg-brand-grey hover:bg-brand-black"
        }`}
      >
        {GEAR}
        Admin
        <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/10">
          {ADMIN_MENU.map((g, gi) => (
            <div key={g.title} className={gi ? "mt-1 border-t border-black/10 pt-1" : ""}>
              <p className="px-4 pb-0.5 pt-2 font-display text-[0.65rem] uppercase tracking-[0.15em] text-brand-grey">{g.title}</p>
              {g.items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  role="menuitem"
                  className={`block px-4 py-2 font-display text-sm uppercase tracking-wide ${
                    current?.href === i.href ? "bg-brand-green-tint text-brand-green-dark" : "text-brand-black hover:bg-brand-light"
                  }`}
                >
                  {i.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
