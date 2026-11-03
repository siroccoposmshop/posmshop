"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import type { Stage } from "@/lib/projects";
import { moveToStage } from "../actions";

/**
 * Stages as a row of steps: green done, ringed current, grey upcoming.
 * Trade Marketing taps a step to make it the current stage.
 */
export function StageTrack({ projectId, stages, canMove, today }: { projectId: string; stages: Stage[]; canMove: boolean; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const current = stages.findIndex((s) => s.status === "active");

  function go(i: number) {
    if (!canMove || pending || i === current) return;
    const s = stages[i];
    const msg = i > current ? `Move to ${s.name}? Stages before it will be marked done.` : `Move back to ${s.name}?`;
    if (!confirm(msg)) return;
    start(async () => {
      const res = await moveToStage(projectId, s.key);
      if (res.error) alert(res.error);
      router.refresh();
    });
  }

  if (!stages.length) return <p className="text-sm">Stages are chosen when Trade Marketing runs the project.</p>;

  return (
    <ol className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 ${pending ? "opacity-60" : ""}`}>
      {stages.map((s, i) => {
        const late = s.status === "active" && !!s.due_date && s.due_date < today;
        const tone =
          s.status === "done"
            ? "bg-brand-green text-white ring-brand-green"
            : s.status === "active"
              ? late
                ? "bg-white text-brand-black ring-2 ring-brand-red"
                : "bg-white text-brand-black ring-2 ring-brand-green"
              : "bg-brand-light text-brand-grey ring-transparent";
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => go(i)}
              disabled={!canMove || pending}
              title={canMove && i !== current ? `Move to ${s.name}` : undefined}
              className={`flex h-full w-full flex-col items-start rounded-xl px-3 py-2 text-left ring-1 transition ${tone} ${
                canMove && i !== current ? "cursor-pointer hover:-translate-y-0.5 hover:shadow" : "cursor-default"
              }`}
            >
              <span className="flex items-center gap-1.5 font-display text-[0.7rem] uppercase tracking-wide opacity-80">
                {s.status === "done" ? "✓ Done" : s.status === "active" ? (late ? "Overdue" : "Now") : `Step ${i + 1}`}
              </span>
              <span className="font-display text-sm font-medium uppercase leading-tight">{s.name}</span>
              <span className="mt-0.5 text-[0.7rem] opacity-80">
                {s.status === "done" ? formatDate(s.completed_at!) : s.due_date ? `Due ${formatDate(s.due_date)}` : `${s.days} days`}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
