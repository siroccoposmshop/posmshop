"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartLine } from "@/components/CartProvider";
import { createClient } from "@/lib/supabase/client";
import { OrderFor } from "@/components/OrderFor";
import { ItemImage } from "@/components/ItemImage";
import { money, qtyOptions } from "@/lib/format";

export function CartView() {
  const cart = useCart();
  if (!cart.ready) return null;

  if (!cart.account) {
    return (
      <div className="bento mx-auto max-w-xl text-center">
        <h1 className="text-3xl text-brand-black">Your cart is empty</h1>
        <p className="mt-2">Start a new order, or check the orders you&apos;ve already placed.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/orders" className="btn btn-secondary">
            My orders
          </Link>
          <Link href="/" className="btn btn-primary">
            Start an order
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <h1 className="accent-square text-4xl text-brand-black">Cart</h1>
        <OrderFor />
      </div>

      {cart.lines.length === 0 ? (
        <div className="bento mt-6 text-center">
          <p>No items yet.</p>
          <Link href="/shop" className="btn btn-primary mt-4">
            Browse items
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {cart.lines.map((line) => {
              const options = qtyOptions(line);
              if (!options.includes(line.qty)) options.push(line.qty);
              options.sort((a, b) => a - b);
              return (
                <li key={line.item_id} className="bento flex items-center gap-4 !p-3 sm:!p-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-brand-light">
                    <ItemImage path={line.image_path} alt={line.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xs uppercase text-brand-green">{line.brand}</p>
                    <p className="line-clamp-2 font-medium leading-tight text-brand-black">{line.name}</p>
                    <p className="text-xs">
                      SKU {line.sku} · {money(line.value)} each
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <select
                      aria-label={`Quantity for ${line.name}`}
                      className="field !w-24 !py-1.5"
                      value={line.qty}
                      onChange={(e) =>
                        cart.setQty(
                          {
                            id: line.item_id,
                            sku: line.sku,
                            brand: line.brand,
                            name: line.name,
                            value: line.value,
                            image_path: line.image_path,
                            order_multiple: line.order_multiple,
                            max_per_order: line.max_per_order,
                            stock: line.stock,
                            category: null,
                            markets: [],
                            visible: true,
                            eta: null,
                            months_of_stock: null,
                            delisted: false,
                            description: null,
                            order_warning: null,
                          },
                          Number(e.target.value),
                        )
                      }
                    >
                      {options.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>
                    <span className="w-28 text-right font-medium text-brand-black">{money(line.qty * line.value)}</span>
                    <button
                      type="button"
                      onClick={() => cart.removeItem(line.item_id)}
                      className="text-xs text-brand-red underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="bento-green mt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-xs uppercase tracking-wide text-white/80">Total value</p>
              <p className="font-display text-3xl font-medium">{money(cart.total)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/shop" className="btn bg-white/15 text-white hover:bg-white/25">
                Add more
              </Link>
              <ReviewButton lines={cart.lines} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type Warning = { line: CartLine; text: string };

/**
 * Goes to the review page, but first shows a reminder for any item in the cart that has an
 * order warning (e.g. "Not for consumers"). Warnings are read fresh from the database.
 */
function ReviewButton({ lines }: { lines: CartLine[] }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [warnings, setWarnings] = useState<Warning[] | null>(null);

  async function review() {
    setChecking(true);
    const { data, error } = await createClient()
      .from("items")
      .select("id, order_warning")
      .in("id", lines.map((l) => l.item_id))
      .not("order_warning", "is", null);
    setChecking(false);
    const found = error
      ? []
      : lines.flatMap((line) => {
          const text = data?.find((d) => d.id === line.item_id)?.order_warning?.trim();
          return text ? [{ line, text }] : [];
        });
    if (found.length) setWarnings(found);
    else router.push("/cart/confirm");
  }

  return (
    <>
      <button
        type="button"
        onClick={review}
        disabled={checking}
        className="btn bg-white text-brand-green hover:bg-brand-light disabled:!opacity-100"
      >
        {checking ? "Checking…" : "Review order →"}
      </button>

      {warnings && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="warning-title"
          onClick={() => setWarnings(null)}
        >
          <div className="w-full max-w-md rounded-[var(--radius-bento)] bg-white p-5 text-brand-grey shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="warning-title" className="accent-square text-2xl text-brand-black">
              Reminder
            </h2>
            <ul className="mt-4 space-y-3">
              {warnings.map(({ line, text }) => (
                <li key={line.item_id} className="flex items-center gap-3 rounded-lg bg-brand-red/5 p-3 ring-1 ring-brand-red/20">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-brand-light">
                    <ItemImage path={line.image_path} alt="" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium leading-tight text-brand-black">{line.name}</p>
                    <p className="text-xs">SKU {line.sku}</p>
                    <p className="mt-1 text-sm font-medium text-brand-red">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn btn-secondary" onClick={() => setWarnings(null)}>
                Back to cart
              </button>
              <button type="button" className="btn btn-primary" autoFocus onClick={() => router.push("/cart/confirm")}>
                Understood, continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
