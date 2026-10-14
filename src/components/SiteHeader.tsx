import Link from "next/link";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { CartButton } from "./CartButton";
import { UserMenu } from "./UserMenu";
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
          <UserMenu profile={profile} links={links} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-brand-green" aria-hidden>
        <div className="ml-auto h-full w-[6%] bg-brand-red" />
      </div>
    </header>
  );
}
