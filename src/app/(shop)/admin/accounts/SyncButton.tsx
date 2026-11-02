"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncSalesforceNow } from "../actions";

export function SyncButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await syncSalesforceNow();
            if (!res.ok) setError(res.error ?? "Sync failed.");
            router.refresh();
          })
        }
      >
        {pending ? "Syncing…" : "Sync now"}
      </button>
      {error && <p className="max-w-sm text-sm text-brand-red sm:text-right">{error}</p>}
    </div>
  );
}
