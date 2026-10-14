"use client";

import { useOptimistic, useTransition } from "react";
import { setItemVisibility } from "../actions";

export function VisibilityToggle({ id, visible }: { id: string; visible: boolean }) {
  const [optimistic, set] = useOptimistic(visible);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={optimistic ? "Hide item" : "Show item"}
      onClick={() =>
        start(async () => {
          set(!optimistic);
          await setItemVisibility(id, !optimistic);
        })
      }
      className={`relative h-6 w-11 rounded-full transition-colors ${optimistic ? "bg-brand-green" : "bg-black/20"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${optimistic ? "left-[1.375rem]" : "left-0.5"}`} />
    </button>
  );
}
