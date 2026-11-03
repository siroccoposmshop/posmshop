"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { markNotificationsRead } from "../actions";

export type Update = { id: string; message: string; created_at: string; project_id: string | null };

/** "X has moved stage" etc. — shown once, the next time someone opens Projects. */
export function UpdatesPopup({ updates }: { updates: Update[] }) {
  const [open, setOpen] = useState(updates.length > 0);
  const [, start] = useTransition();
  if (!open) return null;
  const close = () => {
    setOpen(false);
    start(async () => {
      await markNotificationsRead(updates.map((u) => u.id));
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="updates-title" className="w-full max-w-md rounded-[var(--radius-bento)] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="updates-title" className="accent-square text-2xl text-brand-black">
          Since you were last here
        </h2>
        <ul className="mt-4 max-h-[50dvh] space-y-2 overflow-y-auto">
          {updates.map((u) => (
            <li key={u.id} className="rounded-lg bg-brand-light p-3 text-sm">
              {u.project_id ? (
                <Link href={`/projects/${u.project_id}`} onClick={close} className="text-brand-black hover:underline">
                  {u.message}
                </Link>
              ) : (
                <span className="text-brand-black">{u.message}</span>
              )}
              <span className="mt-0.5 block text-xs">{formatDate(u.created_at, true)}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-primary mt-4 w-full" autoFocus onClick={close}>
          Got it
        </button>
      </div>
    </div>
  );
}
