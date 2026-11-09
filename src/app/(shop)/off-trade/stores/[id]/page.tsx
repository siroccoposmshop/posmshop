import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { formatAed } from "@/lib/hub";
import { OFF_TRADE_STATUS, TARGET_YEAR, VISIBILITY_MAIN, canUseOffTrade, marketName, storeLabel, storeView, type OffTradeProject, type OffTradeStore } from "@/lib/off-trade";
import { ProjectForm, ProjectItem } from "./ProjectForm";
import { StoreSettings } from "./StoreSettings";

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
      <div>
          <p className="font-display text-xs uppercase tracking-wide">
            {s.code.startsWith("TBC-") ? "Store code tbc" : `#${s.code}`}
            {s.chain ? ` · ${s.chain}` : ""}
            {s.store_type ? ` · ${s.store_type}` : ""}
          </p>
          <h1 className="accent-square text-2xl leading-tight text-brand-black sm:text-3xl">{storeLabel(s.name, s.chain)}</h1>
          <p className="mt-1 text-sm">{[s.area, s.city && s.city !== s.area && s.city !== marketName(s.market) ? s.city : null, s.segment, s.tmam && `TM ${s.tmam}`, s.visit_frequency].filter(Boolean).join(" · ")}</p>
      </div>

      <StoreSettings
        storeId={s.id}
        influenced={s.influenced}
        coldRoom={s.coldRoom}
        coldRoomActivated={s.coldRoomActivated}
        openedYear={s.opened_year ?? null}
        targetYear={TARGET_YEAR}
        target={s.target_year === TARGET_YEAR}
        targetViaProject={s.targets.length > 0}
      />

      <section className="bento space-y-3">
        <h2 className="text-xl text-brand-black">Visibility in store</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {VISIBILITY_MAIN.map((m) => {
            const n = s.vis.totals[m];
            return (
              <div key={m} className={`rounded-xl p-3 ${n ? "bg-brand-green-tint" : "bg-brand-light"}`}>
                <p className="flex items-baseline justify-between font-display text-xs uppercase tracking-wide">
                  {m} <span className={`text-lg font-bold ${n ? "text-brand-green-dark" : "text-brand-grey/50"}`}>{n || "–"}</span>
                </p>
                {s.vis.groups[m].map((g) => (
                  <div key={g.group} className="mt-1.5 text-xs">
                    {s.vis.groups[m].length > 1 || g.group.toLowerCase() !== m.toLowerCase() ? <p className="font-medium text-brand-black">{g.group}</p> : null}
                    <p>{g.items.map(([b, q]) => (q > 1 ? `${b} ×${q}` : b)).join(", ")}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {s.vis.groups.Other.length > 0 && (
          <details className="rounded-xl ring-1 ring-black/10">
            <summary className="cursor-pointer px-3 py-2 font-display text-xs uppercase tracking-wide text-brand-black">Other</summary>
            <ul className="space-y-1 px-3 pb-3 text-sm">
              {s.vis.groups.Other.map((g) => (
                <li key={g.group}>
                  <span className="font-medium text-brand-black">{g.group}</span>: {g.items.map(([b, q]) => (q > 1 ? `${b} ×${q}` : b)).join(", ")}
                  {g.logged && <span className="text-xs"> · logged, not counted as visibility</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
        {s.visibility_flag && <p className="text-xs">Master file &ldquo;Visibility&rdquo;: {s.visibility_flag}</p>}
      </section>

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
                    <span className="font-medium text-brand-black">
                      {p.type}
                      {p.item ? ` · ${p.item}` : ""}
                      {p.brand ? ` · ${p.brand}` : ""}
                      {p.quantity && p.quantity > 1 ? ` × ${p.quantity}` : ""}
                    </span>
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
