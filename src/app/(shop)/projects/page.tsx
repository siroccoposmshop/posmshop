import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { formatAed, hubRoleShort } from "@/lib/hub";
import { todayIso } from "@/lib/working-days";
import {
  actionItems,
  byUrgency,
  canApprove,
  hubRole,
  isProjectAdmin,
  loadPeople,
  loadVisibleProjects,
  personName,
  projectHealth,
  projectTitle,
  type Project,
} from "@/lib/projects";
import { ProjectTracker } from "./_components/ProjectTracker";
import { UpdatesPopup, type Update } from "./_components/UpdatesPopup";
import type { ProjectView } from "./_components/types";

export const metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const profile = await requireProfile();
  const role = hubRole(profile);
  const admin = isProjectAdmin(profile);
  const today = todayIso();

  let projects: Project[];
  try {
    projects = await loadVisibleProjects(profile);
  } catch {
    return (
      <div className="bento mx-auto max-w-xl">
        <h1 className="text-2xl text-brand-black">Projects isn&apos;t set up yet</h1>
        <p className="mt-2 text-sm">
          Run <code>supabase/migrations/20261104000000_commerce_hub.sql</code> in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  const people = await loadPeople();
  const name = (id: string | null) => (id ? personName(people.get(id)) : null);
  const views: ProjectView[] = projects
    .map((p) => ({ ...p, health: projectHealth(p, today), kamName: name(p.kam_id) ?? "—", smName: name(p.sm_id), tmName: name(p.tm_id) }))
    .sort(byUrgency);

  const { data: unread } = await createAdminClient()
    .from("notifications")
    .select("id, message, created_at, project_id")
    .eq("user_id", profile.id)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  // Projects a KAM deleted stay visible (under Past) but don't ask for action.
  const open = views.filter((p) => !p.hidden_for_kam);
  const approvals = open.filter((p) => canApprove(profile, p));
  const toVet = admin ? open.filter((p) => p.status === "awaiting_tm") : [];
  const mine = role === "tm" ? open.filter((p) => p.tm_id === profile.id) : open;
  const actions = admin ? actionItems(mine, today) : [];
  const sentBack = open.filter((p) => p.status === "rejected" && p.kam_id === profile.id);
  const live = open.filter((p) => p.status === "live");

  return (
    <div className="space-y-6">
      <UpdatesPopup updates={(unread as Update[]) ?? []} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="accent-square text-4xl text-brand-black">Projects</h1>
          <p className="mt-1 text-sm">
            {hubRoleShort(role)} view ·{" "}
            {role === "kam" ? "your projects" : role === "sm" ? "your team's projects" : "all projects"}
          </p>
        </div>
        <Link href="/projects/new" className="btn btn-primary">
          + New project
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Live" value={live.length} green />
        <Tile label="Behind schedule" value={live.filter((p) => p.health.state === "behind").length} red />
        <Tile label="Requests" value={open.filter((p) => p.status.startsWith("awaiting")).length} />
        <Tile label="Completed" value={open.filter((p) => p.status === "completed").length} />
      </div>

      {(approvals.length > 0 || toVet.length > 0 || actions.length > 0 || sentBack.length > 0) && (
        <div className="grid items-start gap-3 md:grid-cols-2">
          {approvals.length > 0 && (
            <ListCard title="Approvals" count={approvals.length} tone="amber">
              {approvals.map((p) => (
                <Row key={p.id} href={`/projects/${p.id}`} title={projectTitle(p)} sub={`${p.account_name} · ${p.kamName}`} right={formatAed(p.budget_aed)} />
              ))}
            </ListCard>
          )}
          {toVet.length > 0 && (
            <ListCard title="To vet" count={toVet.length} tone="green">
              {toVet.map((p) => (
                <Row key={p.id} href={`/projects/${p.id}`} title={projectTitle(p)} sub={`${p.account_name} · ${p.kamName}`} right={`Wanted ${formatDate(p.desired_date)}`} />
              ))}
            </ListCard>
          )}
          {actions.length > 0 && (
            <ListCard title="Actions" count={actions.length} tone="red">
              {actions.map(({ project: p, stage, overdue }) => (
                <Row
                  key={p.id}
                  href={`/projects/${p.id}`}
                  title={projectTitle(p)}
                  sub={`${stage.name} · ${p.account_name}`}
                  right={<span className={overdue ? "font-medium text-brand-red" : ""}>{overdue ? "Overdue" : "Due"} {formatDate(stage.due_date!)}</span>}
                />
              ))}
            </ListCard>
          )}
          {sentBack.length > 0 && (
            <ListCard title="Needs your attention" count={sentBack.length} tone="red">
              {sentBack.map((p) => (
                <Row key={p.id} href={`/projects/${p.id}`} title={projectTitle(p)} sub={p.rejection_reason ?? "Sent back"} right="Update" />
              ))}
            </ListCard>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-2xl text-brand-black">Project tracker</h2>
        <ProjectTracker projects={views} viewer={{ id: profile.id, isAdmin: admin, isSm: role === "sm" }} today={today} showPeopleFilters={role !== "kam"} />
      </div>
    </div>
  );
}

function Tile({ label, value, green, red }: { label: string; value: number; green?: boolean; red?: boolean }) {
  return (
    <div className={green ? "bento-green" : "bento"}>
      <p className={`font-display text-xs uppercase tracking-wide ${green ? "text-white/80" : ""}`}>{label}</p>
      <p className={`mt-1 font-display text-3xl font-medium ${green ? "" : red && value ? "text-brand-red" : "text-brand-black"}`}>{value}</p>
    </div>
  );
}

const TONES = { amber: "bg-amber-500", green: "bg-brand-green", red: "bg-brand-red" };

function ListCard({ title, count, tone, children }: { title: string; count: number; tone: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <section className="bento">
      <h2 className="flex items-center gap-2 text-xl text-brand-black">
        {title}
        <span className={`badge text-white ${TONES[tone]}`}>{count}</span>
      </h2>
      <ul className="mt-2 divide-y divide-black/5">{children}</ul>
    </section>
  );
}

function Row({ href, title, sub, right }: { href: string; title: string; sub: string; right: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-brand-green-tint">
        <span className="min-w-0">
          <span className="block truncate font-medium text-brand-black">{title}</span>
          <span className="block truncate text-xs">{sub}</span>
        </span>
        <span className="shrink-0 text-right text-xs">{right}</span>
      </Link>
    </li>
  );
}
