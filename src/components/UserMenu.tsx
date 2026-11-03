"use client";

import { useEffect, useState } from "react";
import { SECTIONS, isActivePage, isActiveSection } from "./NavLinks";
import { hubRoleShort } from "@/lib/hub";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./CartProvider";
import type { Profile } from "@/lib/types";

/** Avatar button that opens a slide-in panel from the right with the user's details and navigation. */
export function UserMenu({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { count } = useCart();

  useEffect(() => setMounted(true), []);
  // Close when navigating.
  useEffect(() => setOpen(false), [pathname]);
  // Escape closes; lock page scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const firstName = profile.full_name?.trim().split(/\s+/)[0] || titleCase(profile.email.split("@")[0].split(/[._-]/)[0]);
  const initial = firstName.slice(0, 1);
  const isAdmin = profile.role === "admin";
  const role = `${hubRoleShort(profile.hub_role)}${isAdmin ? " · Admin" : ""}`;
  // POSM Shop lists its pages plus the cart underneath it.
  const sections = SECTIONS.map((s) =>
    s.href === "/posm" ? { ...s, children: [...(s.children ?? []), { href: "/cart", label: count ? `Cart (${count})` : "Cart" }] } : s,
  );

  // Rendered into <body>: the header's backdrop blur would otherwise trap the fixed panel inside it.
  const panel = (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={() => setOpen(false)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Account menu"
        className={`absolute inset-y-0 right-0 flex w-64 max-w-[75vw] flex-col bg-white shadow-xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 bg-brand-green px-4 py-4 text-white">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white font-display text-lg font-medium uppercase text-brand-green">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-medium uppercase leading-tight">{firstName}</p>
            <p className="text-sm text-white/85">{role}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl leading-none hover:bg-white/15"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {sections.map((sec) => {
            const active = isActiveSection(sec.href, pathname);
            return (
              <div key={sec.href} className="mb-1">
                <Link
                  href={sec.href}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 font-display uppercase tracking-wide ${
                    active && !sec.children ? "bg-brand-green-tint text-brand-green-dark" : active ? "text-brand-green-dark" : "text-brand-black hover:bg-brand-light"
                  }`}
                >
                  {sec.label}
                  <span aria-hidden className="text-brand-green">→</span>
                </Link>
                {sec.children && (
                  <div className="ml-3 border-l-2 border-brand-light pl-2">
                    {sec.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={`block rounded-lg px-3 py-2 font-display text-sm uppercase tracking-wide ${
                          isActivePage(c.href, pathname) ? "bg-brand-green-tint text-brand-green-dark" : "text-brand-grey hover:bg-brand-light hover:text-brand-black"
                        }`}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        {isAdmin && (
          <div className="border-t border-black/5 p-2">
            <Link
              href="/admin"
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 font-display uppercase tracking-wide text-white ${
                pathname.startsWith("/admin") ? "bg-brand-black" : "bg-brand-grey hover:bg-brand-black"
              }`}
            >
              Admin
              <span aria-hidden>→</span>
            </Link>
          </div>
        )}

        <form action="/auth/signout" method="post" className="border-t border-black/5 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button className="btn btn-secondary w-full !py-2">Sign out</button>
        </form>
        <div className="h-2 bg-brand-red" aria-hidden />
      </aside>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open account menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light font-display font-medium uppercase text-brand-black hover:bg-brand-green hover:text-white"
      >
        {initial}
      </button>
      {mounted && createPortal(panel, document.body)}
    </>
  );
}

function titleCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : value;
}
