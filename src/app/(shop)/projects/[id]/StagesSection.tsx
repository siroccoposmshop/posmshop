"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { addWorkingDays, dubaiDate, planStages, workingDaysBetween } from "@/lib/working-days";
import { Spinner } from "@/components/Spinner";
import type { Stage, StageType } from "@/lib/projects";
import { StageTrack } from "../_components/StageTrack";
import { editStages } from "../actions";

/** "Stages" with the track, and for Trade Marketing an Edit link that reopens the stage chips. */
export function StagesSection({
  projectId,
  stages,
  stageTypes,
  canEdit,
  canMove,
  targetDate,
  desiredDate,
  today,
  startOpen,
}: {
  projectId: string;
  stages: Stage[];
  stageTypes: StageType[];
  canEdit: boolean;
  canMove: boolean;
  targetDate: string | null;
  desiredDate: string;
  today: string;
  startOpen?: boolean;
}) {
  const [editing, setEditing] = useState(!!startOpen && canEdit);
  return (
    <section id="stages" className="bento scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="flex items-baseline gap-3 text-xl text-brand-black">
          Stages
          {canEdit && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="font-sans text-sm font-normal normal-case tracking-normal text-brand-green underline">
              Edit
            </button>
          )}
        </h2>
        {!editing && (
          <p className="text-xs">
            {targetDate ? `Target ${formatDate(targetDate)}` : ""}
            {canMove ? " · tap a stage to move the project there" : ""}
          </p>
        )}
      </div>
      {editing ? (
        <StageEditor projectId={projectId} stages={stages} stageTypes={stageTypes} targetDate={targetDate} desiredDate={desiredDate} today={today} onDone={() => setEditing(false)} />
      ) : (
        <StageTrack projectId={projectId} stages={stages} canMove={canMove} today={today} />
      )}
    </section>
  );
}

function StageEditor({
  projectId,
  stages,
  stageTypes,
  targetDate,
  desiredDate,
  today,
  onDone,
}: {
  projectId: string;
  stages: Stage[];
  stageTypes: StageType[];
  targetDate: string | null;
  desiredDate: string;
  today: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = stages.find((s) => s.status === "active");
  const byKey = new Map(stages.map((s) => [s.key, s]));
  const [days, setDays] = useState<Record<string, number>>(() =>
    Object.fromEntries(stages.filter((s) => s.status !== "done").map((s) => [s.key, s.days])),
  );

  const activeSort = active?.sort ?? 0;
  const activeDue = active ? addWorkingDays(dubaiDate(active.started_at ?? new Date()), days[active.key] ?? active.days) : today;
  const upcoming = stageTypes.filter((t) => t.sort > activeSort && days[t.key] !== undefined).map((t) => ({ ...t, days: days[t.key] }));
  // If the current stage is already late, the rest can only start from today.
  const plan = planStages(activeDue < today ? today : activeDue, upcoming);
  const end = plan.at(-1)?.due_date ?? activeDue;
  const slack = workingDaysBetween(end, desiredDate);

  const toggle = (t: StageType) =>
    setDays((d) => {
      const next = { ...d };
      if (next[t.key] === undefined) next[t.key] = byKey.get(t.key)?.days ?? t.default_days;
      else delete next[t.key];
      return next;
    });

  const save = () =>
    start(async () => {
      setError(null);
      const res = await editStages(projectId, Object.entries(days).map(([key, d]) => ({ key, days: d })));
      if (res.error) return setError(res.error);
      onDone();
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <p className="text-sm">Add or remove upcoming stages and adjust working days. Done stages stay as they are.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {stageTypes.map((t, i) => {
          const s = byKey.get(t.key);
          const done = s?.status === "done";
          const isActive = s?.status === "active";
          const before = !s && t.sort < activeSort;
          const on = days[t.key] !== undefined;
          const locked = done || isActive || before;
          return (
            <div
              key={t.key}
              className={`flex items-center gap-2 rounded-xl p-2 pr-3 ring-1 ${
                done ? "bg-brand-green text-white ring-brand-green" : isActive ? "bg-white ring-2 ring-brand-green" : on ? "bg-brand-green-tint ring-brand-green" : "bg-white ring-black/10"
              } ${before ? "opacity-40" : ""}`}
            >
              <button
                type="button"
                disabled={locked}
                aria-pressed={on}
                onClick={() => toggle(t)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm ${
                  done ? "bg-white/20" : on || isActive ? "bg-brand-green text-white" : "bg-brand-light text-brand-grey"
                }`}
              >
                {done || on || isActive ? "✓" : i + 1}
              </button>
              <span className="min-w-0 flex-1">
                <span className={`block font-display text-sm font-medium uppercase leading-tight ${done ? "" : on || isActive ? "text-brand-black" : "text-brand-grey"}`}>{t.name}</span>
                <span className={`text-[0.7rem] ${done ? "text-white/85" : ""}`}>
                  {done ? `Done ${formatDate(s!.completed_at!)}` : isActive ? "Current stage" : before ? "Before the current stage" : ""}
                </span>
              </span>
              {(on || isActive) && !done && (
                <label className="flex shrink-0 items-center gap-1 text-xs">
                  <input
                    type="number"
                    min={1}
                    max={250}
                    value={days[t.key]}
                    onChange={(e) => setDays((d) => ({ ...d, [t.key]: Math.max(1, Number(e.target.value) || 1) }))}
                    className="field !w-14 !px-2 !py-1 text-center text-sm"
                    aria-label={`${t.name} working days`}
                  />
                  d
                </label>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl bg-brand-light p-3 text-sm">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
          {active && (
            <li className="flex items-center gap-1">
              <span className="rounded-full bg-white px-2 py-1 font-medium text-brand-black ring-1 ring-brand-green">
                {active.name} · {formatDate(activeDue)}
              </span>
              {plan.length > 0 && <span aria-hidden>→</span>}
            </li>
          )}
          {plan.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1">
              <span className="rounded-full bg-white px-2 py-1 text-brand-black">
                {s.name} <span className="text-brand-grey">· {formatDate(s.due_date)}</span>
              </span>
              {i < plan.length - 1 && <span aria-hidden>→</span>}
            </li>
          ))}
        </ol>
        <p className={`mt-3 font-medium ${slack >= 0 ? "text-brand-green-dark" : "text-brand-red"}`}>
          New expected completion {formatDate(end)}
          {targetDate && end !== targetDate ? ` (was ${formatDate(targetDate)})` : ""}.{" "}
          {slack >= 0 ? `On time for the desired ${formatDate(desiredDate)}.` : `${-slack} working days after the desired ${formatDate(desiredDate)}.`}
        </p>
      </div>

      {error && <p className="text-sm text-brand-red">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={save}>
          {pending ? <Spinner /> : null} Save stages
        </button>
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
