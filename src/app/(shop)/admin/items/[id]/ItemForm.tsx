"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Item, Market } from "@/lib/types";
import { USD_TO_AED } from "@/lib/format";
import { deleteItem, saveItem } from "../../actions";
import { flagSaved, itemsListHref } from "../ListMemory";

export function ItemForm({ item, markets, brands }: { item: Item | null; markets: Market[]; brands: string[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveItem, null);

  // A new item stays on its page so an image can be added; an edited one goes back to the list.
  useEffect(() => {
    if (!state?.ok) return;
    if (!item && state.id) router.replace(`/admin/items/${state.id}`);
    else if (item) {
      flagSaved(`${item.sku} · ${item.name}`);
      router.push(itemsListHref());
    }
  }, [state, item, router]);

  return (
    <form action={action} className="bento space-y-4">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="brand">Brand</label>
          <input id="brand" name="brand" list="brands" className="field" required defaultValue={item?.brand} />
          <datalist id="brands">
            {brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="sku">SKU code</label>
          <input id="sku" name="sku" className="field" required defaultValue={item?.sku} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">Item name</label>
          <input id="name" name="name" className="field" required defaultValue={item?.name} />
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <input id="category" name="category" className="field" defaultValue={item?.category ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="value">Unit cost (USD)</label>
          <input id="value" name="value" type="number" step="0.01" min="0" className="field" required defaultValue={item?.value ?? 0} />
          <p className="mt-1 text-xs">Entered in USD, as in the budgeting Excel. Everyone sees it in AED (× {USD_TO_AED}).</p>
        </div>
        <div>
          <label className="label" htmlFor="stock">Current stock</label>
          <input id="stock" name="stock" type="number" min="0" step="1" className="field" required defaultValue={item?.stock ?? 0} />
          <p className="mt-1 text-xs">Goes down as KAMs order. The next Excel upload overrides it.</p>
        </div>
        <div>
          <label className="label" htmlFor="eta">Back-in-stock ETA</label>
          <input id="eta" name="eta" type="date" className="field" defaultValue={item?.eta ?? ""} />
          <p className="mt-1 text-xs">Shown to KAMs when the item is out of stock.</p>
        </div>
        <div>
          <label className="label" htmlFor="order_multiple">Order multiple</label>
          <input id="order_multiple" name="order_multiple" type="number" min="1" step="1" className="field" required defaultValue={item?.order_multiple ?? 1} />
          <p className="mt-1 text-xs">e.g. 6 for glasses (6, 12, 18…), 1 for coasters.</p>
        </div>
        <div>
          <label className="label" htmlFor="max_per_order">Max per order</label>
          <input id="max_per_order" name="max_per_order" type="number" min="0" step="1" className="field" defaultValue={item?.max_per_order ?? ""} placeholder="No limit" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Comment for KAMs (optional)</label>
          <textarea id="description" name="description" className="field min-h-20" defaultValue={item?.description ?? ""} />
          <p className="mt-1 text-xs">Shown on the item card behind a round “i” button.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="order_warning">Order warning (optional)</label>
          <input
            id="order_warning"
            name="order_warning"
            className="field"
            defaultValue={item?.order_warning ?? ""}
            placeholder="e.g. Not for consumers. OK for customer gifts."
          />
          <p className="mt-1 text-xs">The KAM must confirm this reminder before reviewing an order that includes the item.</p>
        </div>
      </div>

      <fieldset>
        <legend className="label">Visible to markets</legend>
        <div className="flex flex-wrap gap-2">
          {markets.map((m) => (
            <label key={m.code} className="flex cursor-pointer items-center gap-2 rounded-full bg-brand-light px-4 py-2 text-sm has-[:checked]:bg-brand-green has-[:checked]:text-white">
              <input type="checkbox" name="markets" value={m.code} defaultChecked={item ? item.markets.includes(m.code) : true} className="sr-only" />
              {m.name}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="visible" defaultChecked={item?.visible ?? true} className="h-5 w-5 accent-[var(--color-brand-green)]" />
        Live on the shop
      </label>

      {state?.error && <p className="rounded-lg bg-brand-red/10 p-3 text-sm text-brand-red">{state.error}</p>}

      <div className="flex flex-wrap justify-between gap-3">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save item"}
        </button>
        {item && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              if (!confirm(`Delete ${item.name}? Past orders keep their copy of the item.`)) return;
              const res = await deleteItem(item.id);
              if (res?.error) alert(res.error);
              else router.replace(itemsListHref());
            }}
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
