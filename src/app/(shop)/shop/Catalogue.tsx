"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { ItemImage } from "@/components/ItemImage";
import { formatDate, money, qtyOptions, slugify } from "@/lib/format";
import type { Item } from "@/lib/types";

export function Catalogue({ items }: { items: Item[] }) {
  const router = useRouter();
  const cart = useCart();
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (cart.ready && (!cart.account || !cart.contact)) router.replace("/");
  }, [cart.ready, cart.account, cart.contact, router]);

  const market = cart.account?.market;
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!market || i.markets.includes(market)) &&
        (!q || `${i.brand} ${i.name} ${i.sku} ${i.category ?? ""}`.toLowerCase().includes(q)),
    );
  }, [items, market, search]);

  const brands = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of visible) map.set(i.brand, [...(map.get(i.brand) ?? []), i]);
    return [...map.entries()];
  }, [visible]);

  if (!cart.ready || !cart.account) return null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-sm uppercase tracking-wide text-brand-green">Step 2 of 3</p>
          <h1 className="accent-square mt-1 text-4xl text-brand-black">Choose items</h1>
          <p className="mt-1 text-sm">
            For <strong className="text-brand-black">{cart.account.name}</strong> (#{cart.account.account_number}
            {cart.account.parent_name ? `, ${cart.account.parent_name}` : ""}) ·{" "}
            {cart.contact?.name} ·{" "}
            <Link href="/" className="underline">
              change
            </Link>
          </p>
        </div>
      </div>

      {/* Search + brands stay pinned under the header while scrolling */}
      <div className="sticky top-16 z-20 -mx-4 mt-4 border-b border-black/5 bg-brand-light/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary shrink-0 !px-4 !py-2.5 lg:hidden"
            onClick={() => setDrawer(true)}
            aria-expanded={drawer}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
            Brands
          </button>
          {/* Desktop: named brand list */}
          <nav aria-label="Brands" className="hidden min-w-0 flex-1 overflow-x-auto lg:block">
            <ul className="flex gap-2">
              {brands.map(([brand, list]) => (
                <li key={brand} className="shrink-0">
                  <a
                    href={`#brand-${slugify(brand)}`}
                    className="block whitespace-nowrap rounded-full bg-white px-4 py-1.5 font-display text-sm font-medium uppercase tracking-wide text-brand-black ring-1 ring-black/5 hover:bg-brand-green hover:text-white"
                  >
                    {brand} <span className="text-brand-grey/70">{list.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <input
            type="search"
            aria-label="Search items or SKU"
            className="field min-w-0 flex-1 !py-2.5 lg:w-64 lg:flex-none"
            placeholder="Search items or SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Mobile/tablet: side slider */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${drawer ? "" : "pointer-events-none"}`}
        aria-hidden={!drawer}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${drawer ? "opacity-100" : "opacity-0"}`}
          onClick={() => setDrawer(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-brand-green text-white shadow-xl transition-transform ${
            drawer ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-5">
            <h2 className="accent-square text-2xl">Brands</h2>
            <button type="button" onClick={() => setDrawer(false)} aria-label="Close brands" className="p-2 text-2xl leading-none">
              ×
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto px-3 pb-6">
            {brands.map(([brand, list]) => (
              <li key={brand}>
                <a
                  href={`#brand-${slugify(brand)}`}
                  onClick={() => setDrawer(false)}
                  className="flex items-center justify-between rounded-lg px-3 py-3 font-display text-lg uppercase hover:bg-white/15"
                >
                  {brand}
                  <span className="text-sm text-white/70">{list.length}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="h-2 bg-brand-red" />
        </aside>
      </div>

      {brands.length === 0 && (
        <div className="bento mt-8 text-center">
          <p>No items are available for {cart.account.market} yet.</p>
        </div>
      )}

      <div className="mt-6 space-y-10">
        {brands.map(([brand, list]) => (
          <section key={brand} id={`brand-${slugify(brand)}`} className="scroll-mt-36">
            <h2 className="mb-3 flex items-baseline gap-3 text-2xl text-brand-black sm:mb-4 sm:text-3xl">
              {brand}
              <span className="font-sans text-sm normal-case text-brand-grey">{list.length} items</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  const cart = useCart();
  const inCart = cart.lines.find((l) => l.item_id === item.id);
  const options = qtyOptions(item);
  const [qty, setQty] = useState<number>(inCart?.qty ?? options[0] ?? 0);
  const [added, setAdded] = useState(false);
  const oos = item.stock <= 0 || options.length === 0;

  useEffect(() => {
    if (inCart) setQty(inCart.qty);
  }, [inCart]);

  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-bento)] bg-white ring-1 ring-black/5">
      <div className="relative aspect-[4/3] bg-brand-light">
        <ItemImage path={item.image_path} alt={item.name} />
        {item.category && (
          <span className="badge absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate bg-white/90 !text-[0.65rem] text-brand-black sm:left-3 sm:top-3 sm:!text-xs">
            {item.category}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <p className="font-display text-xs uppercase tracking-wide text-brand-green">{item.brand}</p>
        <h3 className="mt-0.5 text-base leading-tight text-brand-black sm:text-lg">{item.name}</h3>
        <p className="text-xs">SKU {item.sku}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-brand-black">{money(item.value)}</span>
          {oos ? (
            <span className="badge bg-brand-red/10 text-brand-red">Out of stock</span>
          ) : (
            <span className="text-xs">{item.stock.toLocaleString()} in stock</span>
          )}
        </div>
        {oos && item.eta && <p className="mt-1 text-xs text-brand-red">Expected back {formatDate(item.eta)}</p>}
        {!oos && (item.order_multiple > 1 || item.max_per_order) && (
          <p className="mt-1 text-xs">
            {item.order_multiple > 1 ? `Packs of ${item.order_multiple}` : ""}
            {item.order_multiple > 1 && item.max_per_order ? " · " : ""}
            {item.max_per_order ? `Max ${item.max_per_order} per order` : ""}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:pt-4">
          <label className="sr-only" htmlFor={`qty-${item.id}`}>
            Quantity
          </label>
          <select
            id={`qty-${item.id}`}
            className="field !py-2 sm:!w-24"
            value={qty}
            disabled={oos}
            onChange={(e) => setQty(Number(e.target.value))}
          >
            {oos ? <option value={0}>0</option> : options.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
          <button
            type="button"
            className="btn btn-primary flex-1 !px-3 !py-2 text-sm sm:text-base"
            disabled={oos}
            onClick={() => {
              cart.addItem(item, qty);
              setAdded(true);
              setTimeout(() => setAdded(false), 1500);
            }}
          >
            {added ? "Added ✓" : inCart ? "Update cart" : "Add to cart"}
          </button>
        </div>
      </div>
    </article>
  );
}
