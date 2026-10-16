"use client";

import { useActionState } from "react";
import { DEFAULT_ORDER_DESK } from "@/lib/markets";
import type { Market } from "@/lib/types";
import { saveMarket } from "../actions";

export function MarketForm({ market }: { market: Market }) {
  const [state, action, pending] = useActionState(saveMarket, null);
  return (
    <form action={action} className="bento space-y-3">
      <input type="hidden" name="code" value={market.code} />
      <h2 className="text-2xl text-brand-black">{market.name}</h2>
      <div>
        <label className="label" htmlFor={`cs-${market.code}`}>Customer Service email(s)</label>
        <input id={`cs-${market.code}`} name="cs_email" defaultValue={market.cs_email ?? ""} placeholder={DEFAULT_ORDER_DESK} className="field" />
        <p className="mt-1 text-xs">Leave blank to use {DEFAULT_ORDER_DESK}.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor={`dd-${market.code}`}>Delivery days</label>
          <input id={`dd-${market.code}`} name="delivery_days" type="number" min={1} defaultValue={market.delivery_days} className="field" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-brand-red">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : state?.ok ? "Saved ✓" : "Save"}
      </button>
    </form>
  );
}
