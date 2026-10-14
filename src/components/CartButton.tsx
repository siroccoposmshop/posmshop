"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./CartProvider";
import { money } from "@/lib/format";

export function CartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20" r="1.3" fill="currentColor" />
      <circle cx="17" cy="20" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function CartButton() {
  const { count, ready } = useCart();
  return (
    <Link
      href="/cart"
      className="relative hidden h-10 items-center gap-2 rounded-full bg-brand-green px-4 font-display text-sm font-medium uppercase text-white md:flex"
    >
      <CartIcon />
      Cart
      {ready && count > 0 && (
        <span className="ml-1 rounded-full bg-white px-2 text-xs text-brand-green">{count}</span>
      )}
    </Link>
  );
}

/** Cart bar stuck to the bottom of the screen on mobile. */
export function MobileCartBar() {
  const { count, total, ready, account } = useCart();
  const pathname = usePathname();
  // Not needed on the cart and confirm pages — they have their own buttons.
  if (!ready || !account || pathname.startsWith("/cart")) return null;
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <Link href="/cart" className="btn btn-primary w-full justify-between !px-5">
        <span className="flex items-center gap-2">
          <CartIcon />
          Cart · {count} {count === 1 ? "item" : "items"}
        </span>
        <span>{money(total)}</span>
      </Link>
    </div>
  );
}
