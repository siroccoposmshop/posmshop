"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { useDialog } from "@/components/Dialog";
import { addOffTradeProject, deleteOffTradeProject, updateOffTradeProject, type ProjectInput } from "../../actions";

const TYPES = ["Branding", "Perfect shelf", "Cold room", "Fridge", "FSU", "Other"];
const STATUSES: { value: ProjectInput["status"]; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export type ProjectRow = {
  id: string;
  type: string;
  status: ProjectInput["status"];
  plan_year: number | null;
  planned_date: string | null;
  completed_date: string | null;
  expected_cost_aed: number | null;
  actual_cost_aed: number | null;
  notes: string | null;
};

/** Add a project to a store, or edit one (complete it with the date and the real cost). */
export function ProjectForm({ storeId, project, targetYear, onDone }: { storeId: string; project?: ProjectRow; targetYear: number; onDone?: () => void }) {
  const router = useRouter();
  const dialog = useDialog();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<ProjectInput>({
    type: project?.type ?? "Branding",
    status: project?.status ?? "planned",
    planYear: project?.plan_year ?? targetYear,
    plannedDate: project?.planned_date ?? "",
    completedDate: project?.completed_date ?? "",
    expectedCost: project?.expected_cost_aed ?? "",
    actualCost: project?.actual_cost_aed ?? "",
    notes: project?.notes ?? "",
  });
  const set = <K extends keyof ProjectInput>(k: K, val: ProjectInput[K]) => setV((x) => ({ ...x, [k]: val }));
  const done = v.status === "completed";

  const save = () =>
    start(async () => {
      setError(null);
      const res = project ? await updateOffTradeProject(project.id, v) : await addOffTradeProject(storeId, v);
      if (res.error) return setError(res.error);
      onDone?.();
      router.refresh();
    });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor={`t-${project?.id ?? "new"}`}>Type</label>
          <select id={`t-${project?.id ?? "new"}`} className="field" value={v.type} onChange={(e) => set("type", e.target.value)}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`s-${project?.id ?? "new"}`}>Status</label>
          <select id={`s-${project?.id ?? "new"}`} className="field" value={v.status} onChange={(e) => set("status", e.target.value as ProjectInput["status"])}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`y-${project?.id ?? "new"}`}>Target year</label>
          <input id={`y-${project?.id ?? "new"}`} className="field" inputMode="numeric" value={v.planYear ?? ""} onChange={(e) => set("planYear", Number(e.target.value) || null)} />
        </div>
        <div>
          <label className="label" htmlFor={`pd-${project?.id ?? "new"}`}>Planned date</label>
          <input id={`pd-${project?.id ?? "new"}`} type="date" className="field" value={v.plannedDate ?? ""} onChange={(e) => set("plannedDate", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`ec-${project?.id ?? "new"}`}>Expected cost (AED)</label>
          <input id={`ec-${project?.id ?? "new"}`} className="field" inputMode="decimal" value={v.expectedCost ?? ""} onChange={(e) => set("expectedCost", e.target.value)} />
        </div>
        {done && (
          <>
            <div>
              <label className="label" htmlFor={`cd-${project?.id ?? "new"}`}>Completed</label>
              <input id={`cd-${project?.id ?? "new"}`} type="date" className="field" value={v.completedDate ?? ""} onChange={(e) => set("completedDate", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor={`ac-${project?.id ?? "new"}`}>Actual cost (AED)</label>
              <input id={`ac-${project?.id ?? "new"}`} className="field" inputMode="decimal" value={v.actualCost ?? ""} onChange={(e) => set("actualCost", e.target.value)} />
            </div>
          </>
        )}
        <div className={done ? "sm:col-span-1" : "sm:col-span-3"}>
          <label className="label" htmlFor={`n-${project?.id ?? "new"}`}>Notes</label>
          <input id={`n-${project?.id ?? "new"}`} className="field" value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending && <Spinner />} {project ? "Save" : "Add project"}
        </button>
        {onDone && (
          <button type="button" className="btn btn-secondary" onClick={onDone} disabled={pending}>
            Close
          </button>
        )}
        {project && (
          <button
            type="button"
            className="ml-auto text-xs text-brand-red underline"
            disabled={pending}
            onClick={async () => {
              if (!(await dialog.confirm({ title: "Delete this project?", message: "It's removed from the store's history.", confirmLabel: "Delete", tone: "danger" }))) return;
              start(async () => {
                const res = await deleteOffTradeProject(project.id);
                if (res.error) return setError(res.error);
                router.refresh();
              });
            }}
          >
            Delete
          </button>
        )}
        {error && <p className="w-full text-sm text-brand-red">{error}</p>}
      </div>
    </form>
  );
}

/** One project in the store's history, with an Edit toggle. */
export function ProjectItem({ storeId, project, targetYear, summary }: { storeId: string; project: ProjectRow; targetYear: number; summary: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{summary}</div>
        <button type="button" className="text-sm underline" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Edit"}
        </button>
      </div>
      {open && (
        <div className="mt-3 rounded-xl bg-brand-light p-3">
          <ProjectForm storeId={storeId} project={project} targetYear={targetYear} onDone={() => setOpen(false)} />
        </div>
      )}
    </li>
  );
}
