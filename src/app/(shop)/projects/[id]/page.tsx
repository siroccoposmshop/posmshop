import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyName, formatDate, outletName } from "@/lib/format";
import { EXTRA_SOURCE_LABEL, STATUS_LABEL, budgetSplit, formatAed, gpCheck, gpWarningText, hubRoleShort } from "@/lib/hub";
import { loadHubSettings } from "@/lib/hub-settings";
import { PICOS_GROUPS, otherOutletsWithTicks, picosItemsFor, picosScores, pointsFor } from "@/lib/picos";
import { InvestmentNote } from "../_components/InvestmentNote";
import { todayIso } from "@/lib/working-days";
import { canApprove, hubRole, isProjectAdmin, loadPeople, loadProject, investmentFor, loadStageTypes, outletLine, personName, projectHealth, projectTitle } from "@/lib/projects";
import { MARKETS } from "@/lib/markets";
import { ProjectBadge } from "../_components/StatusBadge";
import { PicosPromised } from "../_components/PicosPromised";
import { ApprovalPanel, DeleteProject, EditRequest, ProjectAdminPanel, RunProjectPanel } from "./Panels";
import { StagesSection } from "./StagesSection";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  submitted: "Request submitted",
  resubmitted: "Request updated and resubmitted",
  approved_sm: "Approved by Sales Manager",
  approved_cm: "Approved by CM/TMM",
  sent_back: "Sent back to KAM",
  started: "Project started",
  stage: "Stage changed",
  completed: "Project completed",
  paused: "Paused",
  resumed: "Resumed",
  cancelled: "Cancelled",
  reallocated: "Reallocated to a new KAM",
  owner: "Owner changed",
  hidden_by_kam: "Deleted by the KAM",
  stages_edited: "Stages edited",
  picos_delivered: "PICOS item ticked off",
  picos_undelivered: "PICOS item un-ticked",
};

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string; edit?: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const { submitted, edit } = await searchParams;
  const p = await loadProject(id, profile);
  if (!p) notFound();

  const today = todayIso();
  const health = projectHealth(p, today);
  const admin = isProjectAdmin(profile);
  const role = hubRole(profile);
  const [people, stageTypes, settings, investment, { data: events }] = await Promise.all([
    loadPeople(),
    loadStageTypes(),
    loadHubSettings(),
    p.account_id ? investmentFor(p.account_id, p.parent_number, p.id) : Promise.resolve(null),
    createAdminClient().from("project_events").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  const name = (uid: string | null | undefined) => (uid ? personName(people.get(uid)) : "—");
  const all = [...people.values()];
  const owners = all.filter((x) => ["tm", "tmm", "cm"].includes(x.hub_role)).map((x) => ({ id: x.id, name: personName(x) }));
  const kams = all.filter((x) => ["kam", "sm"].includes(x.hub_role)).map((x) => ({ id: x.id, name: `${personName(x)} (${hubRoleShort(x.hub_role)})` }));
  const stages = p.project_stages ?? [];
  const isKam = p.kam_id === profile.id;
  const budget = budgetSplit(p);
  const gp = gpCheck(budget.total, p.incremental_volume_hl, settings);
  const stageName = (key: unknown) => stages.find((s) => s.key === key)?.name ?? stageTypes.find((s) => s.key === key)?.name ?? String(key ?? "");

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/projects" className="text-sm underline">
        ← Projects
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs uppercase tracking-wide">
            {p.ref} · {p.project_type}
          </p>
          <h1 className="accent-square text-2xl leading-tight text-brand-black sm:text-3xl">{projectTitle(p)}</h1>
          <p className="mt-1 text-sm" title={[p.account_name, p.parent_name].filter(Boolean).join(" · ")}>
            {outletLine(p)} · #{p.account_number} · {MARKETS.find((m) => m.code === p.market)?.name ?? p.market}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 pt-1 text-right">
          <ProjectBadge p={{ status: p.status, health, hidden_for_kam: p.hidden_for_kam }} />
          {p.status === "live" && <span className="whitespace-nowrap text-xs">Expected {formatDate(health.forecast ?? p.target_date!)}</span>}
        </div>
      </div>

      {submitted && p.status.startsWith("awaiting") && (
        <p className="rounded-xl bg-brand-green-tint p-4 text-sm text-brand-green-dark">
          ✓ Request submitted. It&apos;s now {STATUS_LABEL[p.status].toLowerCase()}. You&apos;ll be notified as it moves on.
        </p>
      )}
      {p.hidden_for_kam && (
        <div className="rounded-xl border-l-4 border-brand-red bg-brand-red/5 p-4 text-sm">
          <p className="font-medium text-brand-black">Deleted by the KAM</p>
          <p className="mt-1">It&apos;s kept here for the record and no longer counts in the dashboards or digests. Reallocate it to a KAM to bring it back, or cancel it.</p>
        </div>
      )}
      {p.status === "rejected" && (
        <div className="rounded-xl border-l-4 border-brand-red bg-brand-red/5 p-4 text-sm">
          <p className="font-medium text-brand-black">Sent back</p>
          <p className="mt-1">{p.rejection_reason}</p>
        </div>
      )}

      {canApprove(profile, p) && (
        <ApprovalPanel
          id={p.id}
          sirocco={budget.sirocco > 0 ? `Includes ${formatAed(budget.sirocco)} of Sirocco funding (BIF ${formatAed(budget.bif)}).` : undefined}
          gpWarning={gp && gp.level !== "ok" ? { level: gp.level, text: gpWarningText(gp, settings) } : undefined}
          step={
            p.status === "awaiting_sm"
              ? `Budget ${formatAed(p.budget_aed)} needs Sales Manager approval${p.budget_aed >= settings.cmApprovalAed ? ", then CM/TMM" : ""}.`
              : `Budget ${formatAed(p.budget_aed)} needs CM/TMM approval.`
          }
        />
      )}

      {admin && p.status === "awaiting_tm" && !p.hidden_for_kam && (
        <RunProjectPanel
          id={p.id}
          defaultName={`${p.project_type} · ${outletName(p.account_name)}`}
          desiredDate={p.desired_date}
          stageTypes={stageTypes.filter((t) => t.active !== false)}
          owners={owners}
          me={profile.id}
        />
      )}

      {(p.status === "live" || p.status === "paused" || p.status === "completed") && (
        <StagesSection
          projectId={p.id}
          stages={stages}
          stageTypes={stageTypes.filter((t) => t.active !== false || stages.some((s) => s.key === t.key))}
          canEdit={admin && (p.status === "live" || p.status === "paused")}
          canMove={admin && p.status === "live"}
          targetDate={p.target_date}
          desiredDate={p.desired_date}
          today={today}
          startOpen={edit === "stages"}
        />
      )}


      {isKam && ["rejected", "awaiting_sm", "awaiting_cm", "awaiting_tm"].includes(p.status) && (
        <div>
          <EditRequest id={p.id} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="bento space-y-4">
          <h2 className="text-xl text-brand-black">Brief</h2>
          <p className="whitespace-pre-line text-sm text-brand-black">{p.brief}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <Item label="Total budget" value={formatAed(budget.total)} />
            <Item label="BIF" value={formatAed(budget.bif)} />
            {budget.source && <Item label={`${EXTRA_SOURCE_LABEL[budget.source]} funding`} value={formatAed(budget.extra)} />}
            <Item label="Volume budget 2027" value={p.volume_budget_hl != null ? `${p.volume_budget_hl} HL` : "—"} />
            <Item label="Incremental vs budget" value={p.incremental_volume_hl != null ? `${p.incremental_volume_hl} HL` : "—"} />
            <Item label="Desired date" value={formatDate(p.desired_date)} />
            <Item label="Brands" value={p.brands.join(", ")} />
            <Item label="Outlet type" value={p.outlet_type} />
            <Item label="KAM" value={name(p.kam_id)} />
            <Item label="Sales Manager" value={name(p.sm_id)} />
            <Item label="Trade Marketing" value={p.tm_id ? name(p.tm_id) : "Not assigned"} />
          </dl>
          {investment && <InvestmentNote investment={investment} company={companyName(p.parent_name || p.account_name)} />}
          {gp && gp.level !== "ok" && (
            <div className="rounded-lg bg-brand-red px-3 py-2 text-white">
              <p className="font-display text-sm font-bold uppercase tracking-wide">Warning: This investment looks to be GP {gp.level}</p>
              <p className="text-xs text-white/90">{gpWarningText(gp, settings)}</p>
            </div>
          )}
          <div>
            <p className="label">Customer contact</p>
            <p className="text-sm text-brand-black">
              {p.contact_name} · <a href={`tel:${p.contact_mobile.replace(/\s/g, "")}`}>{p.contact_mobile}</a> ·{" "}
              <a href={`mailto:${p.contact_email}`} className="underline">
                {p.contact_email}
              </a>
            </p>
          </div>
        </section>

        <section className="bento space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-xl text-brand-black">PICOS</h2>
            <p className="font-display text-2xl font-bold text-brand-black">
              {p.picos_score_current ?? 0}% <span className="text-brand-grey">→</span> <span className="text-brand-green">{p.picos_score_promised ?? 0}%</span>
            </p>
          </div>
          <div>
            <p className="label">Promised in this deal</p>
            <PicosPromised projectId={p.id} outletType={p.outlet_type} picos={p.picos} canTick={admin || role === "sm"} />
          </div>
          <details>
            <summary className="cursor-pointer text-sm underline">Already in place</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {PICOS_GROUPS.flatMap((g) => picosItemsFor(p.outlet_type).filter((i) => i.group === g && p.picos.items[i.key]?.current)).map((i) => (
                <li key={i.key}>
                  ✓ {i.label} <span className="text-xs">· {pointsFor(i.key, p.outlet_type)} pts</span>
                </li>
              ))}
            </ul>
          </details>
          {otherOutletsWithTicks(p.picos).length > 0 && (
            <div className="space-y-2 border-t border-black/5 pt-3">
              <p className="label">Other outlets in this deal</p>
              {otherOutletsWithTicks(p.picos).map(([oid, o]) => {
                const sc = picosScores(o.outlet_type, { items: o.items, notes: {} });
                return (
                  <details key={oid} className="rounded-lg bg-brand-light px-3 py-2">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                      <span className="min-w-0">
                        <strong className="text-brand-black">{outletName(o.name)}</strong>{" "}
                        <span className="text-xs">
                          · {o.outlet_type} · #{o.account_number}
                        </span>
                      </span>
                      <span className="shrink-0 font-display font-bold text-brand-black">
                        {sc.current}% <span className="text-brand-grey">→</span> <span className="text-brand-green">{sc.promised}%</span>
                      </span>
                    </summary>
                    <div className="mt-2">
                      <PicosPromised projectId={p.id} outletType={o.outlet_type} picos={p.picos} canTick={admin || role === "sm"} outletId={oid} />
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {admin && !["awaiting_sm", "awaiting_cm", "awaiting_tm", "rejected"].includes(p.status) && (
        <ProjectAdminPanel
          id={p.id}
          status={p.status}
          lastStageActive={stages.at(-1)?.status === "active"}
          kams={kams}
          owners={owners}
          kamId={p.kam_id}
          tmId={p.tm_id}
        />
      )}

      <section className="bento">
        <h2 className="text-xl text-brand-black">History</h2>
        <ol className="mt-3 space-y-2">
          {(events ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-black/5 pb-2 text-sm last:border-0">
              <span className="text-brand-black">
                {EVENT_LABEL[e.kind] ?? e.kind}
                {e.kind === "stage" && ` → ${stageName(e.detail?.to)}`}
                {e.kind === "sent_back" && e.detail?.reason ? `: ${e.detail.reason}` : ""}
                {e.kind === "cancelled" && e.detail?.reason ? `: ${e.detail.reason}` : ""}
                {e.kind === "reallocated" ? ` (${name(e.detail?.to as string)})` : ""}
                {e.kind === "owner" ? ` (${name(e.detail?.to as string)})` : ""}
                {e.kind === "stages_edited" && e.detail?.to ? `: expected completion ${formatDate(e.detail.to as string)}` : ""}
              </span>
              <span className="text-xs">
                {name(e.actor_id)} · {formatDate(e.created_at, true)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {isKam && !p.hidden_for_kam && <DeleteProject id={p.id} />}
    </div>
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
