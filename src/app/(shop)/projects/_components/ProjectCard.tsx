"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { formatAed, isRequest } from "@/lib/hub";
import { outletLine, projectTitle } from "@/lib/projects-shared";
import { ProjectBadge } from "./StatusBadge";
import { StageTrack } from "./StageTrack";
import { PicosPromised } from "./PicosPromised";
import type { ProjectView, Viewer } from "./types";

/** Collapsed: name, account, status. Expanded: stages, PICOS promised and the key details. */
export function ProjectCard({ p, viewer, today }: { p: ProjectView; viewer: Viewer; today: string }) {
  const [open, setOpen] = useState(false);
  const h = p.health;
  const progress = h.total ? Math.round((h.done / h.total) * 100) : 0;
  return (
    <article className={`bento !p-0 ${p.status === "live" && h.state === "behind" ? "ring-1 ring-brand-red/40" : ""}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-medium uppercase leading-tight text-brand-black sm:text-lg">{projectTitle(p)}</p>
          <p className="mt-0.5 truncate text-xs">
            {p.trade === "off" && <span className="badge mr-1.5 bg-brand-black !py-0 text-[0.65rem] text-white">Off trade</span>}
            {p.ref} · {p.trade === "off" ? [p.parent_name, p.tmName ? `TM ${p.tmName}` : null].filter(Boolean).join(" · ") : `${outletLine(p)} · ${p.kamName}`}
          </p>
          {p.status === "live" && h.total > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-brand-light">
                <div className={`h-full ${h.state === "behind" ? "bg-brand-red" : "bg-brand-green"}`} style={{ width: `${Math.max(progress, 4)}%` }} />
              </div>
              <span className="shrink-0 text-xs">{h.active ? h.active.name : `${h.done}/${h.total}`}</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ProjectBadge p={p} />
          <span className="text-xs">
            {p.status === "live" || p.status === "paused" ? `Due ${formatDate(h.forecast ?? p.target_date ?? p.desired_date)}` : isRequest(p.status) ? `Submitted ${formatDate(p.submitted_at)}` : ""}
          </span>
        </div>
        <svg viewBox="0 0 20 20" className={`mt-1 h-5 w-5 shrink-0 transition-transform sm:mt-0 ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="space-y-4 border-t border-black/5 p-4">
          <div>
            <p className="label flex items-baseline gap-2">
              Stages
              {viewer.isAdmin && (p.status === "live" || p.status === "paused") && (
                <Link href={`/projects/${p.id}?edit=stages#stages`} className="font-sans text-xs normal-case tracking-normal text-brand-green underline">
                  Edit
                </Link>
              )}
            </p>
            <StageTrack projectId={p.id} stages={p.project_stages ?? []} canMove={viewer.isAdmin && p.status === "live"} today={today} />
          </div>
          {p.trade === "off" ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <Item label="Type" value={p.project_type} />
              <Item label="Brands" value={p.brands.join(", ")} />
              <Item label="Estimated cost" value={formatAed(p.budget_aed)} />
              <Item label="Target date" value={formatDate(p.desired_date)} />
              <Item label="Expected" value={h.forecast ? formatDate(h.forecast) : "—"} />
              <Item label="Trade Marketing" value={p.tmName ?? "—"} />
            </dl>
          ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Item label="Type" value={p.project_type} />
              <Item label="Brands" value={p.brands.join(", ")} />
              <Item label="Budget" value={formatAed(p.budget_aed)} />
              <Item label="Desired date" value={formatDate(p.desired_date)} />
              <Item label="Expected" value={h.forecast ? formatDate(h.forecast) : "—"} />
              <Item label="PICOS" value={p.picos_score_current != null ? `${p.picos_score_current}% → ${p.picos_score_promised}%` : "—"} />
              <Item label="Sales Manager" value={p.smName ?? "—"} />
              <Item label="Trade Marketing" value={p.tmName ?? "Not assigned"} />
            </dl>
            <div>
              <p className="label">PICOS promised</p>
              <PicosPromised projectId={p.id} outletType={p.outlet_type} picos={p.picos} canTick={viewer.isAdmin || viewer.isSm} />
            </div>
          </div>
          )}
          <Link href={`/projects/${p.id}`} className="btn btn-secondary !py-1.5 text-sm">
            Open project →
          </Link>
        </div>
      )}
    </article>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-display text-[0.7rem] uppercase tracking-wide">{label}</dt>
      <dd className="text-brand-black">{value || "—"}</dd>
    </div>
  );
}
