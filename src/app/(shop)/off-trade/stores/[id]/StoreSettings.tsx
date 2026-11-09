"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { formatDate } from "@/lib/format";
import { setStoreColdRoom, setStoreInfluenced, setStoreOpenedYear, setStoreTarget } from "../../actions";

type Props = {
  storeId: string;
  influenced: boolean;
  coldRoom: boolean;
  coldRoomActivated: string | null;
  openedYear: number | null;
  targetYear: number;
  target: boolean;
  targetViaProject: boolean;
};

/** The store's settings in one row: influenced, cold room, opened, target. Each saves on change. */
export function StoreSettings(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.error) setError(res.error);
      router.refresh();
    });
  const now = new Date().getFullYear();
  const years = Array.from({ length: now + 2 - 2015 }, (_, i) => now + 1 - i);

  return (
    <section className="bento !py-4" aria-label="Store settings">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <label className="space-y-1">
          <span className="label !mb-0">Influenced</span>
          <select className="field !py-1.5" value={p.influenced ? "yes" : "no"} disabled={pending} onChange={(e) => run(() => setStoreInfluenced(p.storeId, e.target.value === "yes"))}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="label !mb-0">Cold room</span>
          <select className="field !py-1.5" value={p.coldRoom ? "yes" : "no"} disabled={pending} onChange={(e) => run(() => setStoreColdRoom(p.storeId, e.target.value === "yes"))}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          {p.coldRoom && (
            <span className={`block text-xs ${p.coldRoomActivated ? "text-brand-green-dark" : ""}`}>
              {p.coldRoomActivated ? `Activated ${formatDate(p.coldRoomActivated)}` : "Not activated yet"}
            </span>
          )}
        </label>
        <label className="space-y-1">
          <span className="label !mb-0">Opened</span>
          <select
            className="field !py-1.5"
            value={p.openedYear ?? ""}
            disabled={pending}
            onChange={(e) => run(() => setStoreOpenedYear(p.storeId, e.target.value ? Number(e.target.value) : null))}
          >
            <option value="">Before 2025</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
            {p.openedYear && !years.includes(p.openedYear) && <option value={p.openedYear}>{p.openedYear}</option>}
          </select>
        </label>
        <div className="space-y-1">
          <span className="label !mb-0">Target {p.targetYear}</span>
          <button
            type="button"
            disabled={pending}
            aria-pressed={p.target}
            onClick={() => run(() => setStoreTarget(p.storeId, p.target ? null : p.targetYear))}
            className={`btn w-full !py-1.5 text-sm ${p.target ? "btn-primary" : "btn-secondary"}`}
          >
            {p.target ? "✓ Target" : "+ Make target"}
          </button>
          {p.targetViaProject && !p.target && <span className="block text-xs">Already a target through its {p.targetYear} project</span>}
        </div>
      </div>
      {(pending || error) && (
        <p className="mt-2 flex items-center gap-2 text-xs">
          {pending && (
            <>
              <Spinner /> Saving…
            </>
          )}
          {error && <span className="text-brand-red">{error}</span>}
        </p>
      )}
    </section>
  );
}
