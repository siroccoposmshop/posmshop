"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { useCart } from "./CartProvider";
import type { Profile } from "@/lib/types";

/** Avatar button that opens a slide-in panel from the right with the user's details and navigation. */
export function UserMenu({ profile, links }: { profile: Profile; links: { href: string; label: string }[] }) {
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

  const initial = (profile.full_name || profile.email).slice(0, 1);
  const allLinks = [...links.slice(0, 2), { href: "/cart", label: count ? `Cart (${count})` : "Cart" }, ...links.slice(2)];

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
        className={`absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-white shadow-xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-black/5 p-4">
          <Logo className="h-8 w-auto" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none hover:bg-brand-light"
          >
            ×
          </button>
        </div>

        <div className="bg-brand-green p-5 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white font-display text-xl font-medium uppercase text-brand-green">
            {initial}
          </div>
          <p className="mt-3 font-display text-xl font-medium uppercase leading-tight">{profile.full_name || profile.email}</p>
          <p className="truncate text-sm text-white/85">{profile.email}</p>
          <p className="mt-1 text-sm text-white/85">
            {profile.role === "admin" ? "Trade Marketing (admin)" : "Key Account Manager"}
            {profile.market ? ` · ${profile.market}` : ""}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {allLinks.map((l) => {
            const active = l.href === "/" ? pathname === "/" || pathname.startsWith("/shop") : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center justify-between rounded-lg px-3 py-3 font-display text-lg uppercase tracking-wide ${
                  active ? "bg-brand-green-tint text-brand-green-dark" : "text-brand-black hover:bg-brand-light"
                }`}
              >
                {l.label}
                <span aria-hidden className="text-brand-green">→</span>
              </Link>
            );
          })}
        </nav>

        <form action="/auth/signout" method="post" className="border-t border-black/5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button className="btn btn-secondary w-full">Sign out</button>
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
