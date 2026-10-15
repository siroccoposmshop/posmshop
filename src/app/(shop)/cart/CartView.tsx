"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
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
                            description: null,
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
              <Link href="/cart/confirm" className="btn bg-white text-brand-green hover:bg-brand-light">
                Review order →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
