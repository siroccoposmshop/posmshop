"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { ItemImage } from "@/components/ItemImage";
import { money } from "@/lib/format";
import { MARKETS } from "@/lib/markets";
import { placeOrder } from "../../orders/actions";

export function ConfirmOrder() {
  const cart = useCart();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);

  // Mobile "Place order" bar appears once the bottom of the page is reached.
  useEffect(() => {
    const el = endRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setAtEnd(entry.isIntersecting), { rootMargin: "0px 0px 40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cart.ready, cart.lines.length]);

  useEffect(() => {
    if (cart.ready && (!cart.account || !cart.contact || cart.lines.length === 0)) router.replace("/cart");
  }, [cart.ready, cart.account, cart.contact, cart.lines.length, router]);

  if (!cart.ready || !cart.account || !cart.contact || cart.lines.length === 0) return null;
  const marketName = MARKETS.find((m) => m.code === cart.account?.market)?.name ?? cart.account.market;
  const { account, contact } = cart;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await placeOrder({
        accountId: account.id,
        contact: { name: contact.name, mobile: contact.mobile, email: contact.email },
        notes,
        lines: cart.lines.map((l) => ({ item_id: l.item_id, qty: l.qty })),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      cart.clear();
      router.replace(`/orders/${result.orderId}?placed=1`);
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="accent-square text-4xl text-brand-black">Confirm order</h1>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="bento">
          <h2 className="label">Deliver to</h2>
          <p className="font-display text-xl font-medium uppercase leading-tight text-brand-black">{account.name}</p>
          {account.parent_name && <p className="mt-1 text-sm leading-snug">{account.parent_name}</p>}
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-black/5 pt-3 text-xs">
            <div>
              <dt className="uppercase tracking-wide text-brand-grey/70">Outlet</dt>
              <dd className="font-medium text-brand-black">{account.account_number}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-brand-grey/70">Account</dt>
              <dd className="font-medium text-brand-black">{account.parent_number}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-brand-grey/70">Market</dt>
              <dd className="font-medium text-brand-black">{marketName}</dd>
            </div>
          </dl>
        </div>
        <div className="bento">
          <h2 className="label">Contact</h2>
          <p className="font-display text-xl font-medium uppercase leading-tight text-brand-black">{contact.name}</p>
          <ul className="mt-3 space-y-2 border-t border-black/5 pt-3 text-sm">
            <li className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-brand-green" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" strokeLinejoin="round" />
              </svg>
              <a href={`tel:${contact.mobile.replace(/\s/g, "")}`} className="text-brand-black no-underline">
                {contact.mobile}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-brand-green" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" strokeLinejoin="round" />
              </svg>
              <a href={`mailto:${contact.email}`} className="min-w-0 break-all text-brand-black no-underline">
                {contact.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="bento mt-4 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="hidden sm:table-cell" />
              <th>Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {cart.lines.map((l) => (
              <tr key={l.item_id}>
                <td className="hidden w-14 sm:table-cell">
                  <div className="h-12 w-12 overflow-hidden rounded bg-brand-light">
                    <ItemImage path={l.image_path} alt={l.name} />
                  </div>
                </td>
                <td>
                  <span className="block font-medium text-brand-black">{l.name}</span>
                  <span className="text-xs">
                    {l.brand} · {l.sku}
                  </span>
                </td>
                <td className="text-right">{l.qty}</td>
                <td className="whitespace-nowrap text-right">{money(l.qty * l.value)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="hidden sm:table-cell" />
              <td colSpan={2} className="text-right font-display font-medium uppercase">
                Total
              </td>
              <td className="whitespace-nowrap text-right text-lg font-medium text-brand-black">{money(cart.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bento mt-4">
        <label htmlFor="notes" className="label">
          Notes for Customer Service (optional)
        </label>
        <textarea
          id="notes"
          className="field min-h-24"
          value={notes}
          maxLength={1000}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Delivery instructions, timing, etc."
        />
      </div>

      {error && <p className="mt-4 rounded-lg bg-brand-red/10 p-3 text-sm text-brand-red">{error}</p>}

      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <Link href="/cart" className="btn btn-secondary">
          ← Back to cart
        </Link>
        {/* Desktop: button in the page. Mobile: pinned bar below, shown once scrolled to the end. */}
        <button type="button" className="btn btn-primary hidden md:inline-flex" onClick={submit} disabled={pending}>
          {pending ? "Placing order…" : "Place order"}
        </button>
      </div>
      <p className="mt-3 text-xs">
        Placing the order emails a confirmation to you, to {contact.email}, and to Customer Service for {marketName}.
      </p>
      <div ref={endRef} aria-hidden className="h-px" />

      <div
        className={`no-print fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform md:hidden ${
          atEnd ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!atEnd}
      >
        <button type="button" className="btn btn-primary w-full justify-between !px-5" onClick={submit} disabled={pending || !atEnd}>
          <span>{pending ? "Placing order…" : "Place order"}</span>
          <span>{money(cart.total)}</span>
        </button>
      </div>
    </div>
  );
}
