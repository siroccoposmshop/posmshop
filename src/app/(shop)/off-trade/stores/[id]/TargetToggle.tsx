"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { setStoreTarget } from "../../actions";

/** "Target 2027": a store can be a target before the project is known. */
export function TargetToggle({ storeId, year, on, viaProject }: { storeId: string; year: number; on: boolean; viaProject: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        aria-pressed={on}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await setStoreTarget(storeId, on ? null : year);
            if (res.error) setError(res.error);
            router.refresh();
          })
        }
        className={`btn !py-1.5 text-sm ${on ? "btn-primary" : "btn-secondary"}`}
      >
        {pending ? <Spinner /> : on ? "✓" : "+"} Target {year}
      </button>
      {viaProject && !on && <span className="text-xs">Already a target through its {year} project</span>}
      {error && <span className="text-xs text-brand-red">{error}</span>}
    </div>
  );
}
