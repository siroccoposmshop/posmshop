"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { setStoreOpenedYear } from "../../actions";

/** The year the store opened: History counts it as an outlet from that year on. */
export function OpenedYear({ storeId, year }: { storeId: string; year: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const now = new Date().getFullYear();
  const years = Array.from({ length: now + 2 - 2015 }, (_, i) => now + 1 - i);
  return (
    <label className="flex flex-col items-end gap-1 text-xs">
      <span className="flex items-center gap-2">
        {pending && <Spinner />}
        <span className="font-display uppercase tracking-wide">Opened</span>
        <select
          className="field !w-auto !py-1.5 text-sm"
          value={year ?? ""}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              setError(null);
              const res = await setStoreOpenedYear(storeId, e.target.value ? Number(e.target.value) : null);
              if (res.error) setError(res.error);
              router.refresh();
            })
          }
        >
          <option value="">Before 2025</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
          {year && !years.includes(year) && <option value={year}>{year}</option>}
        </select>
      </span>
      {error && <span className="text-brand-red">{error}</span>}
    </label>
  );
}
