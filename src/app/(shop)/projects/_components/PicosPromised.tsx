"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { pointsFor, promisedItems, type Picos } from "@/lib/picos";
import { Spinner } from "@/components/Spinner";
import { togglePicosDelivered } from "../actions";

/** PICOS negotiated in the deal. SMs and Trade Marketing tick each one off once it's in place. */
export function PicosPromised({
  projectId,
  outletType,
  picos,
  canTick,
  outletId,
}: {
  projectId: string;
  outletType: string;
  picos: Picos;
  canTick: boolean;
  /** Another outlet under the customer (its items live in picos.others). */
  outletId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // The item being saved, and its new state, so the tick changes straight away.
  const [saving, setSaving] = useState<{ key: string; on: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const source = outletId ? (picos.others?.[outletId]?.items ?? {}) : picos.items;
  const items = promisedItems(outletType, { items: source, notes: {} });
  if (!items.length) return <p className="text-sm">No PICOS changes recorded.</p>;
  const isOn = (key: string) => (saving?.key === key ? saving.on : !!source[key]?.delivered_at);
  const done = items.filter((i) => isOn(i.key)).length;

  const toggle = (key: string) => {
    setError(null);
    setSaving({ key, on: !isOn(key) });
    start(async () => {
      const res = await togglePicosDelivered(projectId, key, outletId);
      if (res.error) setError(res.error);
      router.refresh();
      setSaving(null);
    });
  };

  return (
    <div>
      <p className="mb-1 text-xs">
        {done} of {items.length} in place
      </p>
      <ul className="divide-y divide-black/5">
        {items.map((i) => {
          const at = source[i.key]?.delivered_at;
          const on = isOn(i.key);
          const busy = pending && saving?.key === i.key;
          return (
            <li key={i.key} className={`flex items-center justify-between gap-3 rounded-md py-1.5 transition-colors ${busy ? "bg-brand-green-tint" : ""}`}>
              <label className={`flex items-center gap-2 text-sm ${canTick && !pending ? "cursor-pointer" : ""}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-brand-green)]"
                  checked={on}
                  disabled={!canTick || pending}
                  onChange={() => toggle(i.key)}
                />
                <span className={on ? "text-brand-black" : ""}>{i.label}</span>
              </label>
              <span className="flex shrink-0 items-center gap-1 text-xs">
                {busy ? (
                  <>
                    <Spinner className="h-3.5 w-3.5 text-brand-green" /> Saving…
                  </>
                ) : on && at ? (
                  `✓ ${formatDate(at)}`
                ) : (
                  `${pointsFor(i.key, outletType)} pts`
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-1 text-xs text-brand-red">{error}</p>}
      {!outletId && (picos.notes.availability || picos.notes.visibility || picos.notes.affordability) && (
        <dl className="mt-2 space-y-1 text-xs">
          {(["availability", "visibility", "affordability"] as const).map((k) =>
            picos.notes[k] ? (
              <div key={k}>
                <dt className="inline font-medium capitalize text-brand-black">{k}: </dt>
                <dd className="inline">{picos.notes[k]}</dd>
              </div>
            ) : null,
          )}
        </dl>
      )}
    </div>
  );
}
