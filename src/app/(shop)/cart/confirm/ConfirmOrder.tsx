"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { ItemImage } from "@/components/ItemImage";
import { money } from "@/lib/format";
import { placeOrder } from "../../orders/actions";

export function ConfirmOrder() {
  const cart = useCart();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cart.ready && (!cart.account || !cart.contact || cart.lines.length === 0)) router.replace("/cart");
  }, [cart.ready, cart.account, cart.contact, cart.lines.length, router]);

  if (!cart.ready || !cart.account || !cart.contact || cart.lines.length === 0) return null;
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
      <p className="font-display text-sm uppercase tracking-wide text-brand-green">Step 3 of 3</p>
      <h1 className="accent-square mt-1 text-4xl text-brand-black">Confirm order</h1>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="bento">
          <h2 className="text-lg text-brand-black">Deliver to</h2>
          <p className="mt-1 font-medium text-brand-black">{account.name}</p>
          <p className="text-sm">
            Outlet #{account.account_number} · {account.market}
          </p>
          <p className="mt-1 text-sm">
            {account.parent_name} (#{account.parent_number})
          </p>
        </div>
        <div className="bento">
          <h2 className="text-lg text-brand-black">Contact</h2>
          <p className="mt-1 font-medium text-brand-black">{contact.name}</p>
          <p className="text-sm">{contact.mobile}</p>
          <p className="text-sm">{contact.email}</p>
        </div>
      </div>

      <div className="bento mt-4 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th colSpan={2}>Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {cart.lines.map((l) => (
              <tr key={l.item_id}>
                <td className="w-14">
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
              <td colSpan={3} className="text-right font-display font-medium uppercase">
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
        <button type="button" className="btn btn-primary" onClick={submit} disabled={pending}>
          {pending ? "Placing order…" : "Place order"}
        </button>
      </div>
      <p className="mt-3 text-xs">
        Placing the order emails a confirmation to you, to {contact.email}, and to Customer Service for{" "}
        {account.market}.
      </p>
    </div>
  );
}
