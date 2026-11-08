"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { formatDate } from "@/lib/format";
import { setStoreColdRoom } from "../../actions";

/** A cold room is a feature of the store; what we track is whether we've activated it. */
export function ColdRoom({ storeId, has, set, fromList, activated }: { storeId: string; has: boolean; set: boolean | null; fromList: boolean; activated: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const value = set === null ? "" : set ? "yes" : "no";
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 ${has ? (activated ? "bg-brand-green-tint" : "bg-amber-50") : "bg-brand-light"}`}>
      <div>
        <p className="font-display text-xs uppercase tracking-wide text-brand-black">Cold room</p>
        <p className="text-sm">
          {!has ? (
            "No cold room"
          ) : activated ? (
            <span className="font-medium text-brand-green-dark">Has one · activated {formatDate(activated)}</span>
          ) : (
            <span className="font-medium text-brand-black">Has one · not activated yet</span>
          )}
        </p>
      </div>
      <label className="flex items-center gap-2 text-xs">
        {pending && <Spinner />}
        <span>Store has a cold room?</span>
        <select
          className="field !w-auto !py-1.5 text-sm"
          value={value}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              setError(null);
              const v = e.target.value;
              const res = await setStoreColdRoom(storeId, v === "" ? null : v === "yes");
              if (res.error) setError(res.error);
              router.refresh();
            })
          }
        >
          <option value="">As the store list says ({fromList ? "yes" : "no"})</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      {error && <p className="w-full text-xs text-brand-red">{error}</p>}
    </div>
  );
}
