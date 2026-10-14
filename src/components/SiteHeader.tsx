import Link from "next/link";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { CartButton } from "./CartButton";
import type { Profile } from "@/lib/types";

export function SiteHeader({ profile }: { profile: Profile }) {
  const links = [
    { href: "/", label: "Order" },
    { href: "/orders", label: "My orders" },
    ...(profile.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <header className="no-print sticky top-0 z-30 border-b border-black/5 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="POSM SHOP home">
          <Logo className="h-8 w-auto sm:h-9" />
          <span className="hidden border-l border-brand-grey/30 pl-3 font-display text-lg font-medium uppercase tracking-wide text-brand-black sm:inline">
            POSM Shop
          </span>
        </Link>
        <div className="hidden md:block">
          <NavLinks links={links} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <CartButton />
          <Link href="/orders" className="rounded-full px-3 py-1.5 font-display text-sm font-medium uppercase md:hidden">
            Orders
          </Link>
          <details className="relative">
            <summary
              className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-brand-light font-display font-medium uppercase text-brand-black"
              aria-label="Account menu"
            >
              {(profile.full_name || profile.email).slice(0, 1)}
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white p-4 text-sm shadow-lg ring-1 ring-black/5">
              <p className="font-medium text-brand-black">{profile.full_name || profile.email}</p>
              <p className="truncate text-xs">{profile.email}</p>
              <p className="mt-1 text-xs">
                {profile.role === "admin" ? "Trade Marketing (admin)" : "Key Account Manager"}
                {profile.market ? ` · ${profile.market}` : ""}
              </p>
              <nav className="mt-3 flex flex-col border-t border-black/5 pt-2 md:hidden">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} className="rounded-lg px-2 py-2 font-display uppercase tracking-wide text-brand-black hover:bg-brand-light">
                    {l.label}
                  </Link>
                ))}
              </nav>
              <form action="/auth/signout" method="post" className="mt-3">
                <button className="btn btn-secondary w-full !py-2">Sign out</button>
              </form>
            </div>
          </details>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-brand-green" aria-hidden>
        <div className="ml-auto h-full w-[6%] bg-brand-red" />
      </div>
    </header>
  );
}
