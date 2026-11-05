"use client";

import { useDialog } from "@/components/Dialog";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ItemImage } from "@/components/ItemImage";
import { setItemOrder } from "../actions";

type Row = { id: string; name: string; sku: string; image_path: string | null; visible: boolean; positioned: boolean };

/** "Reorder" for one brand: drag rows (or use the arrows) into the order the shop should show, then save. */
export function ReorderItems({ brand, items }: { brand: string; items: Row[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(items);
  const [dragging, setDragging] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dialog = useDialog();

  useEffect(() => {
    if (!open) return;
    setRows(items);
    setError(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, items]);

  const move = (from: number, to: number) =>
    setRows((r) => {
      if (to < 0 || to >= r.length || from === to) return r;
      const next = [...r];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });

  const save = (ids: string[]) =>
    start(async () => {
      setError(null);
      const res = await setItemOrder(brand, ids);
      if (res.error) return setError(res.error);
      setOpen(false);
      router.refresh();
    });

  const customised = items.some((i) => i.positioned);

  return (
    <>
      <button type="button" className="btn btn-secondary !py-1.5 text-sm" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M7 4v12M7 16l-3-3M7 16l3-3M13 16V4M13 4l-3 3M13 4l3 3" />
        </svg>
        Reorder {brand}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reorder-title"
            className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-[var(--radius-bento)] bg-white shadow-xl sm:rounded-[var(--radius-bento)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-black/5 p-5 pb-3">
              <h2 id="reorder-title" className="accent-square text-2xl text-brand-black">
                Reorder {brand}
              </h2>
              <p className="mt-1 text-sm">Drag items into the order KAMs should see them, or use the arrows.</p>
            </div>

            <ol className="min-h-0 flex-1 overflow-y-auto p-3">
              {rows.map((r, i) => (
                <li
                  key={r.id}
                  draggable
                  onDragStart={(e) => {
                    setDragging(i);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragging !== null && dragging !== i) {
                      move(dragging, i);
                      setDragging(i);
                    }
                  }}
                  onDragEnd={() => setDragging(null)}
                  className={`flex cursor-grab items-center gap-3 rounded-lg p-2 active:cursor-grabbing ${
                    dragging === i ? "bg-brand-green-tint ring-2 ring-brand-green" : "hover:bg-brand-light"
                  } ${r.visible ? "" : "opacity-60"}`}
                >
                  <span className="w-6 shrink-0 text-right font-display text-sm text-brand-grey">{i + 1}</span>
                  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-brand-grey" fill="currentColor" aria-hidden>
                    <circle cx="7" cy="5" r="1.5" /><circle cx="13" cy="5" r="1.5" /><circle cx="7" cy="10" r="1.5" />
                    <circle cx="13" cy="10" r="1.5" /><circle cx="7" cy="15" r="1.5" /><circle cx="13" cy="15" r="1.5" />
                  </svg>
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-brand-light">
                    <ItemImage path={r.image_path} alt="" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-tight text-brand-black">{r.name}</p>
                    <p className="text-xs">
                      {r.sku}
                      {r.visible ? "" : " · hidden"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" aria-label={`Move ${r.name} up`} disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded p-1.5 hover:bg-white disabled:opacity-25">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5-5 5 5" /></svg>
                    </button>
                    <button type="button" aria-label={`Move ${r.name} down`} disabled={i === rows.length - 1} onClick={() => move(i, i + 1)} className="rounded p-1.5 hover:bg-white disabled:opacity-25">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 8l5 5 5-5" /></svg>
                    </button>
                  </div>
                </li>
              ))}
            </ol>

            <div className="space-y-2 border-t border-black/5 p-4">
              {error && <p className="text-sm text-brand-red">{error}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {customised ? (
                  <button
                    type="button"
                    className="text-sm underline"
                    disabled={pending}
                    onClick={async () => (await dialog.confirm({ title: "Reset to automatic?", message: `Go back to the automatic order for ${brand}?`, confirmLabel: "Reset" })) && save([])}
                  >
                    Reset to automatic
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={pending}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => save(rows.map((r) => r.id))} disabled={pending}>
                    {pending ? "Saving…" : "Save order"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
