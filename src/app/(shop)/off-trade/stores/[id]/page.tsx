import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { formatAed } from "@/lib/hub";
import { OFF_TRADE_STATUS, TARGET_YEAR, canUseOffTrade, marketName, storeView, type OffTradeProject, type OffTradeStore } from "@/lib/off-trade";
import { ProjectForm, ProjectItem } from "./ProjectForm";
import { TargetToggle } from "./TargetToggle";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  if (!canUseOffTrade(profile)) redirect("/");
  const { id } = await params;
  const db = createAdminClient();
  const [{ data: store }, { data: projects }] = await Promise.all([
    db.from("off_trade_stores").select("*").eq("id", id).maybeSingle(),
    db.from("off_trade_projects").select("*").eq("store_id", id),
  ]);
  if (!store) notFound();
  const s = storeView(store as OffTradeStore, (projects as OffTradeProject[]) ?? []);
  const tone: Record<string, string> = {
    completed: "bg-brand-green-tint text-brand-green-dark",
    in_progress: "bg-amber-500 text-white",
    planned: "bg-white text-brand-black ring-1 ring-black/15",
    cancelled: "bg-brand-light text-brand-grey",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/off-trade" className="text-sm underline">
        ← Off trade
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-xs uppercase tracking-wide">
            #{s.code}
            {s.chain ? ` · ${s.chain}` : ""}
          </p>
          <h1 className="accent-square text-2xl leading-tight text-brand-black sm:text-3xl">{s.name}</h1>
          <p className="mt-1 text-sm">{[s.area, s.market && marketName(s.market), s.segment, s.tmam && `TM ${s.tmam}`, s.visit_frequency].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          {s.influenced ? <span className="badge bg-brand-green text-white">Influenced</span> : <span className="badge bg-brand-light text-brand-grey">Not influenced</span>}
          <TargetToggle storeId={s.id} year={TARGET_YEAR} on={s.target_year === TARGET_YEAR} viaProject={s.targets.length > 0} />
        </div>
      </div>

      <section className="bento space-y-3">
        <h2 className="text-xl text-brand-black">Add a project</h2>
        <ProjectForm storeId={s.id} targetYear={TARGET_YEAR} />
      </section>

      <section className="bento">
        <h2 className="text-xl text-brand-black">Projects</h2>
        {!s.projects.length ? (
          <p className="mt-2 text-sm">Nothing recorded for this store yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-black/5">
            {s.projects.map((p) => (
              <ProjectItem
                key={p.id}
                storeId={s.id}
                project={p}
                targetYear={TARGET_YEAR}
                summary={
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-medium text-brand-black">{p.type}</span>
                    <span className={`badge ${tone[p.status]}`}>{OFF_TRADE_STATUS[p.status]}</span>
                    <span className="text-sm">
                      {p.status === "completed" && p.completed_date
                        ? `Completed ${formatDate(p.completed_date)}`
                        : p.planned_date
                          ? `Planned ${formatDate(p.planned_date)}`
                          : p.plan_year
                            ? `Target ${p.plan_year}`
                            : ""}
                    </span>
                    <span className="text-sm">
                      {p.expected_cost_aed != null ? `Expected ${formatAed(Number(p.expected_cost_aed))}` : ""}
                      {p.actual_cost_aed != null ? ` · Actual ${formatAed(Number(p.actual_cost_aed))}` : ""}
                    </span>
                    {p.notes && <span className="w-full text-xs">{p.notes}</span>}
                  </div>
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
