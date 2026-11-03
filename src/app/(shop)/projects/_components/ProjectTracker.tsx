"use client";

import { useMemo, useState } from "react";
import { PROJECT_TYPES, isPast, isRequest } from "@/lib/hub";
import { projectTitle } from "@/lib/projects-shared";
import { ProjectCard } from "./ProjectCard";
import type { ProjectView, Viewer } from "./types";

type Tab = "live" | "requests" | "past";

/** Live / requests / past projects, most urgent first, with search and filters. */
export function ProjectTracker({ projects, viewer, today, showPeopleFilters }: { projects: ProjectView[]; viewer: Viewer; today: string; showPeopleFilters: boolean }) {
  const [tab, setTab] = useState<Tab>("live");
  const [q, setQ] = useState("");
  const [sm, setSm] = useState("");
  const [kam, setKam] = useState("");
  const [tm, setTm] = useState("");
  const [type, setType] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Projects a KAM deleted are kept for the record under Past.
  const inTab = (p: ProjectView, t: Tab) =>
    p.hidden_for_kam
      ? t === "past"
      : t === "live"
        ? p.status === "live" || p.status === "paused"
        : t === "requests"
          ? isRequest(p.status)
          : isPast(p.status);
  const counts = { live: 0, requests: 0, past: 0 };
  for (const p of projects) for (const t of ["live", "requests", "past"] as Tab[]) if (inTab(p, t)) counts[t]++;

  const names = (pick: (p: ProjectView) => string | null) => [...new Set(projects.map(pick).filter((x): x is string => !!x))].sort();
  const options = useMemo(() => ({ sm: names((p) => p.smName), kam: names((p) => p.kamName), tm: names((p) => p.tmName) }), [projects]); // eslint-disable-line react-hooks/exhaustive-deps

  const needle = q.trim().toLowerCase();
  const shown = projects.filter(
    (p) =>
      inTab(p, tab) &&
      (!sm || p.smName === sm) &&
      (!kam || p.kamName === kam) &&
      (!tm || p.tmName === tm) &&
      (!type || p.project_type === type) &&
      (!needle ||
        [projectTitle(p), p.ref, p.account_name, p.parent_name ?? "", p.project_type, ...p.brands].some((v) => v.toLowerCase().includes(needle))),
  );
  const filtered = !!(q || sm || kam || tm || type);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-black/5" role="tablist">
          {(["live", "requests", "past"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 font-display text-sm font-medium uppercase tracking-wide ${tab === t ? "bg-brand-green text-white" : "hover:text-brand-black"}`}
            >
              {t === "live" ? "Live" : t === "requests" ? "Requests" : "Past"} <span className="opacity-75">{counts[t]}</span>
            </button>
          ))}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search project, customer, brand, type" className="field !w-full !py-2 text-sm sm:!w-72" />
          <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className="btn btn-secondary shrink-0 !px-3 !py-2 text-sm sm:hidden">
            Filters{sm || kam || tm || type ? " •" : ""}
          </button>
        </div>
      </div>

      <div className={`${showFilters ? "grid" : "hidden"} gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]`}>
        {showPeopleFilters && <Filter label="All sales managers" value={sm} onChange={setSm} options={options.sm} />}
        {showPeopleFilters && <Filter label="All KAMs" value={kam} onChange={setKam} options={options.kam} />}
        <Filter label="All Trade Marketing" value={tm} onChange={setTm} options={options.tm} />
        <Filter label="All types" value={type} onChange={setType} options={[...PROJECT_TYPES]} />
        {filtered && (
          <button
            type="button"
            className="btn btn-secondary !py-2 text-sm"
            onClick={() => {
              setQ("");
              setSm("");
              setKam("");
              setTm("");
              setType("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="bento text-center text-sm">{filtered ? "No projects match these filters." : tab === "live" ? "No live projects yet." : tab === "requests" ? "No open requests." : "No past projects yet."}</p>
      ) : (
        <div className="space-y-2">
          {shown.map((p) => (
            <ProjectCard key={p.id} p={p} viewer={viewer} today={today} />
          ))}
        </div>
      )}
    </section>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="field !py-2 text-sm" aria-label={label}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}
