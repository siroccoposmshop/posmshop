"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { DeliveryCards, OrderLinesTable } from "@/components/OrderSummary";
import { money } from "@/lib/format";
import { MARKETS } from "@/lib/markets";
import { placeOrder } from "../../orders/actions";

export function ConfirmOrder() {
  const cart = useCart();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Set once the order is placed, so emptying the cart doesn't bounce us to the empty cart page.
  const placedRef = useRef(false);

  useEffect(() => {
    if (placedRef.current) return;
    if (cart.ready && (!cart.account || !cart.contact || cart.lines.length === 0)) router.replace("/cart");
  }, [cart.ready, cart.account, cart.contact, cart.lines.length, router]);

  if (placedRef.current) return <p className="py-10 text-center text-sm">Opening your order…</p>;
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
      placedRef.current = true;
      router.replace(`/orders/${result.orderId}?placed=1`);
      cart.clear();
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="accent-square text-4xl text-brand-black">Confirm order</h1>

      <div className="mt-6 space-y-4">
        <DeliveryCards
          info={{
            outletName: account.name,
            outletNumber: account.account_number,
            parentName: account.parent_name,
            parentNumber: account.parent_number,
            market: account.market,
            contactName: contact.name,
            contactMobile: contact.mobile,
            contactEmail: contact.email,
          }}
        />
        <OrderLinesTable
          total={cart.total}
          lines={cart.lines.map((l) => ({
            key: l.item_id,
            name: l.name,
            brand: l.brand,
            sku: l.sku,
            image_path: l.image_path,
            qty: l.qty,
            lineValue: l.qty * l.value,
          }))}
        />
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
        {/* Desktop: button here. Mobile: full-width button at the end of the page, just above the footer. */}
        <button type="button" className="btn btn-primary hidden md:inline-flex" onClick={submit} disabled={pending}>
          {pending ? "Placing order…" : "Place order"}
        </button>
      </div>
      <button
        type="button"
        className="btn btn-primary mt-5 w-full justify-between !px-5 !py-4 md:hidden"
        onClick={submit}
        disabled={pending}
      >
        <span>{pending ? "Placing order…" : "Place order"}</span>
        <span>{money(cart.total)}</span>
      </button>
      <p className="mt-3 text-xs">
        Placing the order emails a confirmation to you and MMI Customer Service, and the delivery details to{" "}
        {contact.email}.
      </p>
    </div>
  );
}
