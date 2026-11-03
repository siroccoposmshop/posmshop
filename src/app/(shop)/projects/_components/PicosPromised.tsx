"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { pointsFor, promisedItems, type Picos } from "@/lib/picos";
import { togglePicosDelivered } from "../actions";

/** PICOS negotiated in the deal. SMs and Trade Marketing tick each one off once it's in place. */
export function PicosPromised({ projectId, outletType, picos, canTick }: { projectId: string; outletType: string; picos: Picos; canTick: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const items = promisedItems(outletType, picos);
  if (!items.length) return <p className="text-sm">No PICOS changes recorded.</p>;
  const done = items.filter((i) => picos.items[i.key]?.delivered_at).length;
  return (
    <div>
      <p className="mb-1 text-xs">
        {done} of {items.length} in place
      </p>
      <ul className={`divide-y divide-black/5 ${pending ? "opacity-60" : ""}`}>
        {items.map((i) => {
          const at = picos.items[i.key]?.delivered_at;
          return (
            <li key={i.key} className="flex items-center justify-between gap-3 py-1.5">
              <label className={`flex items-center gap-2 text-sm ${canTick ? "cursor-pointer" : ""}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-brand-green)]"
                  checked={!!at}
                  disabled={!canTick || pending}
                  onChange={() =>
                    start(async () => {
                      const res = await togglePicosDelivered(projectId, i.key);
                      if (res.error) alert(res.error);
                      router.refresh();
                    })
                  }
                />
                <span className={at ? "text-brand-black" : ""}>{i.label}</span>
              </label>
              <span className="shrink-0 text-xs">{at ? `✓ ${formatDate(at)}` : `${pointsFor(i.key, outletType)} pts`}</span>
            </li>
          );
        })}
      </ul>
      {(picos.notes.availability || picos.notes.visibility || picos.notes.affordability) && (
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
