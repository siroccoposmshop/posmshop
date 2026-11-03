import Link from "next/link";
import { Logo } from "./Logo";
import { AdminLink, NavLinks, SectionNav } from "./NavLinks";
import { CartButton } from "./CartButton";
import { UserMenu } from "./UserMenu";
import { AdminBadge } from "./AdminBadge";
import type { Profile } from "@/lib/types";

export function SiteHeader({ profile }: { profile: Profile }) {
  const isAdmin = profile.role === "admin";
  // The section bar sits below the sticky header (not inside it), so other sticky bars keep their 64px offset.
  return (
    <>
    <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur">
      <div className="relative border-b border-black/5">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          {isAdmin && <AdminBadge />}
          <Link href="/" className="flex items-center gap-3" aria-label="Commerce Hub home">
            <Logo className="h-8 w-auto sm:h-9" />
            <span className="hidden border-l border-brand-grey/30 pl-3 font-display text-lg font-medium uppercase tracking-wide text-brand-black sm:inline">
              Commerce Hub
            </span>
          </Link>
          <div className="hidden lg:block">
            <NavLinks />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <CartButton />
            {isAdmin && <AdminLink className="hidden lg:flex" />}
            <UserMenu profile={profile} />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-brand-green" aria-hidden>
          <div className="ml-auto h-full w-[6%] bg-brand-red" />
        </div>
      </div>
    </header>
    <SectionNav />
    </>
  );
}
