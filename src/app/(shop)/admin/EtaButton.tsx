"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { setItemEta } from "./actions";

/** Shows an item's ETA (or an "Add ETA" button) and edits it in place. */
export function EtaButton({ id, eta }: { id: string; eta: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(eta ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string | null) {
    setPending(true);
    setError(null);
    const res = await setItemEta(id, next);
    setPending(false);
    if (res.error) return setError(res.error);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return eta ? (
      <button type="button" onClick={() => setEditing(true)} className="text-xs underline decoration-dotted" title="Change ETA">
        ETA {formatDate(eta)}
      </button>
    ) : (
      <button type="button" onClick={() => setEditing(true)} className="badge bg-brand-red text-white hover:bg-brand-red/85">
        Add ETA
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value) save(value);
      }}
      className="inline-flex flex-col items-end gap-1"
    >
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          required
          disabled={pending}
          aria-label="ETA date"
          className="field !w-auto !px-2 !py-1 text-xs"
        />
        <button className="btn btn-primary !px-3 !py-1 text-xs" disabled={pending || !value}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="flex gap-3 text-xs">
        {eta && (
          <button type="button" onClick={() => save(null)} disabled={pending} className="underline">
            Clear ETA
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue(eta ?? "");
            setError(null);
          }}
          disabled={pending}
          className="underline"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-brand-red">{error}</p>}
    </form>
  );
}
