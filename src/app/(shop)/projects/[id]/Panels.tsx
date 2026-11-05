"use client";

import { useDialog } from "@/components/Dialog";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { formatAed } from "@/lib/hub";
import { planStages, todayIso, workingDaysBetween } from "@/lib/working-days";
import { Spinner } from "@/components/Spinner";
import { approveProject, cancelProject, completeProject, hideForMe, reallocateProject, runProject, sendBack, setOwner, setPaused } from "../actions";

type Option = { id: string; name: string };
type StageType = { key: string; name: string; default_days: number; sort: number };

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.error) return setError(res.error);
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

/** SM / CM / TMM: approve the request or send it back with a reason. */
export function ApprovalPanel({
  id,
  step,
  sirocco,
  gpWarning,
}: {
  id: string;
  step: string;
  sirocco?: string;
  gpWarning?: { level: "neutral" | "negative"; text: string };
}) {
  const { pending, error, run } = useAction();
  const [back, setBack] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <section className="bento border-2 border-amber-500">
      <h2 className="text-xl text-brand-black">Your approval</h2>
      <p className="mt-1 text-sm">{step}</p>
      {sirocco && (
        <p className="mt-2 rounded-lg border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm font-medium text-brand-black">⚠ {sirocco}</p>
      )}
      {gpWarning && (
        <div className="mt-2 rounded-lg bg-brand-red px-3 py-2 text-white">
          <p className="font-display text-sm font-bold uppercase tracking-wide">Warning: This investment looks to be GP {gpWarning.level}</p>
          <p className="text-xs text-white/90">{gpWarning.text}</p>
        </div>
      )}
      {back ? (
        <div className="mt-3 space-y-2">
          <textarea className="field min-h-20" placeholder="What should the KAM change?" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <button className="btn btn-danger" disabled={pending} onClick={() => run(() => sendBack(id, reason))}>
              Send back
            </button>
            <button className="btn btn-secondary" onClick={() => setBack(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={pending} onClick={() => run(() => approveProject(id))}>
            {pending ? <Spinner /> : "✓"} Approve
          </button>
          <button className="btn btn-secondary" onClick={() => setBack(true)}>
            Send back
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}
    </section>
  );
}

/**
 * Trade Marketing vets the request: tap the stages needed (each with its working days), see the
 * estimated execution date against the KAM's desired date, name it and run it.
 */
export function RunProjectPanel({
  id,
  defaultName,
  desiredDate,
  stageTypes,
  owners,
  me,
}: {
  id: string;
  defaultName: string;
  desiredDate: string;
  stageTypes: StageType[];
  owners: Option[];
  me: string;
}) {
  const { pending, error, run } = useAction();
  const [name, setName] = useState(defaultName);
  const [owner, setOwnerId] = useState(owners.some((o) => o.id === me) ? me : (owners[0]?.id ?? me));
  const [chosen, setChosen] = useState<Record<string, number>>(() => Object.fromEntries(stageTypes.map((s) => [s.key, s.default_days])));
  const [back, setBack] = useState(false);
  const [reason, setReason] = useState("");

  const selected = stageTypes.filter((s) => chosen[s.key] !== undefined).map((s) => ({ ...s, days: chosen[s.key] }));
  const today = todayIso();
  const plan = useMemo(() => planStages(today, selected), [today, selected]);
  const end = plan.at(-1)?.due_date ?? today;
  const slack = workingDaysBetween(end, desiredDate);
  const totalDays = selected.reduce((n, s) => n + s.days, 0);

  const toggle = (key: string, days: number) =>
    setChosen((c) => {
      const next = { ...c };
      if (next[key] === undefined) next[key] = days;
      else delete next[key];
      return next;
    });

  return (
    <section className="bento space-y-4 border-2 border-brand-green">
      <div>
        <h2 className="text-xl text-brand-black">Vet &amp; run</h2>
        <p className="text-sm">Tap the stages this project needs. Days are working days (Mon–Fri) and can be adjusted.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {stageTypes.map((s, i) => {
          const on = chosen[s.key] !== undefined;
          return (
            <div key={s.key} className={`flex items-center gap-2 rounded-xl p-2 pr-3 ring-1 transition ${on ? "bg-brand-green-tint ring-brand-green" : "bg-white ring-black/10"}`}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.key, s.default_days)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm ${on ? "bg-brand-green text-white" : "bg-brand-light text-brand-grey"}`}
              >
                {on ? "✓" : i + 1}
              </button>
              <button type="button" onClick={() => toggle(s.key, s.default_days)} className={`min-w-0 flex-1 text-left font-display text-sm font-medium uppercase leading-tight ${on ? "text-brand-black" : "text-brand-grey"}`}>
                {s.name}
              </button>
              {on && (
                <label className="flex shrink-0 items-center gap-1 text-xs">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={chosen[s.key]}
                    onChange={(e) => setChosen((c) => ({ ...c, [s.key]: Math.max(1, Number(e.target.value) || 1) }))}
                    className="field !w-14 !px-2 !py-1 text-center text-sm"
                    aria-label={`${s.name} working days`}
                  />
                  d
                </label>
              )}
            </div>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="rounded-xl bg-brand-light p-3">
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
            {plan.map((s, i) => (
              <li key={s.key} className="flex items-center gap-1">
                <span className="rounded-full bg-white px-2 py-1 text-brand-black">
                  {s.name} <span className="text-brand-grey">· {formatDate(s.due_date)}</span>
                </span>
                {i < plan.length - 1 && <span aria-hidden>→</span>}
              </li>
            ))}
          </ol>
          <p className={`mt-3 text-sm font-medium ${slack >= 0 ? "text-brand-green-dark" : "text-brand-red"}`}>
            Estimated execution {formatDate(end)} ({totalDays} working days).{" "}
            {slack >= 0
              ? `On time for the desired ${formatDate(desiredDate)}${slack ? `, ${slack} days to spare` : ""}.`
              : `${-slack} working days after the desired ${formatDate(desiredDate)}.`}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="run-name">Project name</label>
          <input id="run-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="run-owner">Support (Trade Marketing)</label>
          <select id="run-owner" className="field" value={owner} onChange={(e) => setOwnerId(e.target.value)}>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {back ? (
        <div className="space-y-2">
          <textarea className="field min-h-20" placeholder="What should the KAM change?" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <button className="btn btn-danger" disabled={pending} onClick={() => run(() => sendBack(id, reason))}>
              Send back
            </button>
            <button className="btn btn-secondary" onClick={() => setBack(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-primary"
            disabled={pending || !selected.length}
            onClick={() => run(() => runProject(id, { name, tmId: owner, stages: selected.map((s) => ({ key: s.key, days: s.days })) }))}
          >
            {pending ? <Spinner /> : "▶"} Run project
          </button>
          <button className="btn btn-secondary" onClick={() => setBack(true)}>
            Send back to KAM
          </button>
        </div>
      )}
      {error && <p className="text-sm text-brand-red">{error}</p>}
    </section>
  );
}

/** Trade Marketing on a live / paused project: complete, pause, reassign, cancel. */
export function ProjectAdminPanel({
  id,
  status,
  lastStageActive,
  kams,
  owners,
  kamId,
  tmId,
  budget,
}: {
  id: string;
  status: string;
  lastStageActive: boolean;
  budget: number;
  kams: Option[];
  owners: Option[];
  kamId: string;
  tmId: string | null;
}) {
  const { pending, error, run } = useAction();
  const [kam, setKam] = useState(kamId);
  const [tm, setTm] = useState(tmId ?? "");
  // Completing asks for the final cost first.
  const [completing, setCompleting] = useState(false);
  const [cost, setCost] = useState("");
  const dialog = useDialog();
  const costNum = Number(cost.replace(/[^0-9.]/g, ""));
  const costOk = cost.trim() !== "" && Number.isFinite(costNum) && costNum >= 0;
  const diff = costOk ? costNum - budget : 0;
  return (
    <section className="bento space-y-3">
      <h2 className="text-xl text-brand-black">Manage</h2>
      <div className="flex flex-wrap items-center gap-2">
        {status === "live" && !completing && (
          <button className={`btn ${lastStageActive ? "btn-primary" : "btn-secondary"}`} disabled={pending} onClick={() => setCompleting(true)}>
            ✓ Complete project
          </button>
        )}
        {/* Pause / resume and cancel sit apart, on the right. */}
        <span className="ml-auto" />
        {status === "live" && (
          <button className="btn btn-secondary" disabled={pending} onClick={() => run(() => setPaused(id, true))}>
            Pause
          </button>
        )}
        {status === "paused" && (
          <button className="btn btn-primary" disabled={pending} onClick={() => run(() => setPaused(id, false))}>
            Resume
          </button>
        )}
        {status !== "cancelled" && status !== "completed" && (
          <button
            className="btn btn-danger"
            disabled={pending}
            onClick={() => {
              void (async () => {
                const why = await dialog.prompt({
                  title: "Cancel this project?",
                  message: "It moves to Past projects. Add a reason if you like.",
                  placeholder: "Reason (optional)",
                  confirmLabel: "Cancel project",
                  cancelLabel: "Keep project",
                  tone: "danger",
                });
                if (why !== null) run(() => cancelProject(id, why));
              })();
            }}
          >
            Cancel project
          </button>
        )}
      </div>
      {completing && (
        <form
          className="space-y-3 rounded-xl bg-brand-green-tint p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (costOk) run(() => completeProject(id, costNum), () => setCompleting(false));
          }}
        >
          <div>
            <p className="font-display text-sm font-medium uppercase tracking-wide text-brand-black">Complete the project</p>
            <p className="text-xs">Enter what the project actually cost. It&apos;s kept as the project&apos;s final cost for reports.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="m-cost">Final cost (AED)</label>
              <input id="m-cost" className="field !w-48" inputMode="decimal" placeholder={String(Math.round(budget))} value={cost} onChange={(e) => setCost(e.target.value)} autoFocus />
            </div>
            <p className="pb-2 text-sm">
              Budget {formatAed(budget)}
              {costOk && diff !== 0 && (
                <span className={diff > 0 ? "text-brand-red" : "text-brand-green-dark"}>
                  {" "}
                  · {diff > 0 ? "+" : "−"}
                  {formatAed(Math.abs(diff))} {diff > 0 ? "over" : "under"}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={pending || !costOk}>
              {pending ? <Spinner /> : "✓"} Complete project
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setCompleting(false)} disabled={pending}>
              Back
            </button>
          </div>
        </form>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="m-kam">Project lead</label>
          <div className="flex gap-2">
            <select id="m-kam" className="field" value={kam} onChange={(e) => setKam(e.target.value)}>
              {kams.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary !px-3" disabled={pending || kam === kamId} onClick={() => run(() => reallocateProject(id, kam))}>
              Reallocate
            </button>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="m-tm">Support (Trade Marketing)</label>
          <div className="flex gap-2">
            <select id="m-tm" className="field" value={tm} onChange={(e) => setTm(e.target.value)}>
              <option value="">Not assigned</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary !px-3" disabled={pending || !tm || tm === tmId} onClick={() => run(() => setOwner(id, tm))}>
              Save
            </button>
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-brand-red">{error}</p>}
    </section>
  );
}

/** The KAM's "Edit & resubmit" for a request that's sent back or still waiting. */
export function EditRequest({ id }: { id: string }) {
  return (
    <Link href={`/projects/new?edit=${id}`} className="btn btn-primary">
      Edit &amp; resubmit
    </Link>
  );
}

/** The KAM deletes a project: it leaves their projects, but SM, CM, TM and TMM still see it as deleted. */
export function DeleteProject({ id }: { id: string }) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  const dialog = useDialog();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
      {error && <span className="text-xs text-brand-red">{error}</span>}
      <button
        type="button"
        disabled={pending}
        className="text-xs text-brand-red underline decoration-brand-red/40 hover:decoration-brand-red disabled:opacity-50"
        onClick={() =>
          void (async () => {
            const ok = await dialog.confirm({
              title: "Delete this project?",
              message: "It will be removed from your projects. Trade Marketing keeps a record of it.",
              confirmLabel: "Delete",
              tone: "danger",
            });
            if (ok) run(() => hideForMe(id), () => router.push("/projects"));
          })()
        }
      >
        {pending ? "Deleting…" : "Delete project"}
      </button>
    </div>
  );
}
