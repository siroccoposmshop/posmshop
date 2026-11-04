import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROJECT_ADMINS, SEES_ALL, type HubRole, type ProjectStatus } from "@/lib/hub";
import { addWorkingDays, planStages, todayIso, workingDaysBetween } from "@/lib/working-days";
import type { Picos } from "@/lib/picos";
import type { Profile } from "@/lib/types";

export type Stage = {
  id: string;
  project_id: string;
  key: string;
  name: string;
  sort: number;
  days: number;
  status: "pending" | "active" | "done";
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type Project = {
  id: string;
  ref: string;
  name: string | null;
  status: ProjectStatus;
  kam_id: string;
  sm_id: string | null;
  tm_id: string | null;
  account_id: string | null;
  account_number: string;
  account_name: string;
  parent_number: string | null;
  parent_name: string | null;
  market: string | null;
  project_type: string;
  brands: string[];
  outlet_type: string;
  contact_name: string;
  contact_mobile: string;
  contact_email: string;
  budget_aed: number;
  budget_bif?: number | null;
  budget_extra?: number | null;
  budget_extra_source?: "sirocco" | "other" | null;
  brief: string;
  volume_budget_hl: number | null;
  incremental_volume_hl: number | null;
  desired_date: string;
  picos: Picos;
  picos_score_current: number | null;
  picos_score_promised: number | null;
  target_date: string | null;
  rejection_reason: string | null;
  hidden_for_kam: boolean;
  submitted_at: string;
  sm_approved_at: string | null;
  cm_approved_at: string | null;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
  project_stages?: Stage[];
};

export type StageType = { key: string; name: string; default_days: number; sort: number; active?: boolean };
export type Person = { id: string; email: string; full_name: string | null; hub_role: HubRole; manager_id: string | null };

export const hubRole = (p: Pick<Profile, "hub_role">): HubRole => p.hub_role ?? "kam";
export const isProjectAdmin = (p: Pick<Profile, "hub_role">) => PROJECT_ADMINS.includes(hubRole(p));
export const personName = (p: Pick<Person, "full_name" | "email"> | undefined | null) => p?.full_name || p?.email?.split("@")[0] || "—";

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

/** KAM ids an SM looks after (plus themselves). */
async function teamIds(sm: Profile) {
  const { data } = await createAdminClient().from("profiles").select("id").eq("manager_id", sm.id);
  return [sm.id, ...(data ?? []).map((r) => r.id as string)];
}

/** Projects this person may see, with their stages. */
export async function loadVisibleProjects(profile: Profile) {
  const db = createAdminClient();
  let q = db.from("projects").select("*, project_stages(*)").order("submitted_at", { ascending: false }).limit(1000);
  const role = hubRole(profile);
  if (!SEES_ALL.includes(role)) {
    if (role === "sm") {
      const ids = await teamIds(profile);
      q = q.or(`kam_id.in.(${ids.join(",")}),sm_id.eq.${profile.id}`);
    } else {
      q = q.eq("kam_id", profile.id).eq("hidden_for_kam", false);
    }
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data as Project[]) ?? []).map(sortStages);
}

export async function loadProject(id: string, profile: Profile) {
  const { data } = await createAdminClient().from("projects").select("*, project_stages(*)").eq("id", id).maybeSingle();
  if (!data) return null;
  const project = sortStages(data as Project);
  return (await canView(profile, project)) ? project : null;
}

export async function canView(profile: Profile, p: Project) {
  const role = hubRole(profile);
  if (SEES_ALL.includes(role)) return true;
  if (p.kam_id === profile.id) return !p.hidden_for_kam;
  if (role === "sm") return p.sm_id === profile.id || (await teamIds(profile)).includes(p.kam_id);
  return false;
}

/** Whether this person approves this project at its current step. */
export function canApprove(profile: Profile, p: Project) {
  if (p.hidden_for_kam) return false;
  const role = hubRole(profile);
  if (p.status === "awaiting_sm") return p.sm_id === profile.id || role === "cm" || role === "tmm";
  if (p.status === "awaiting_cm") return role === "cm" || role === "tmm";
  return false;
}

function sortStages(p: Project): Project {
  return { ...p, project_stages: [...(p.project_stages ?? [])].sort((a, b) => a.sort - b.sort) };
}

export async function loadPeople() {
  const { data } = await createAdminClient().from("profiles").select("id, email, full_name, hub_role, manager_id").eq("active", true);
  return new Map(((data as Person[]) ?? []).map((p) => [p.id, p]));
}

export async function loadStageTypes() {
  const { data } = await createAdminClient().from("project_stage_types").select("*").order("sort");
  return (data as StageType[]) ?? [];
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export type Health = {
  state: "on_track" | "due_soon" | "behind" | "none";
  /** Expected completion (re-planned from the current stage). */
  forecast: string | null;
  /** Working days behind the target (positive = late). */
  daysLate: number;
  active: Stage | null;
  done: number;
  total: number;
};

export function projectHealth(p: Project, today = todayIso()): Health {
  const stages = p.project_stages ?? [];
  const active = stages.find((s) => s.status === "active") ?? null;
  const done = stages.filter((s) => s.status === "done").length;
  const base = { active, done, total: stages.length };
  if (p.status !== "live" || !active || !p.target_date) {
    return { ...base, state: "none", forecast: p.target_date, daysLate: 0 };
  }
  const activeDue = active.due_date ?? today;
  const overdue = today > activeDue;
  const rest = stages.filter((s) => s.sort > active.sort);
  const from = overdue ? today : activeDue;
  const forecast = rest.length ? planStages(from, rest).at(-1)!.due_date : from;
  const daysLate = Math.max(0, workingDaysBetween(p.target_date, forecast));
  const state = overdue || daysLate > 0 ? "behind" : workingDaysBetween(today, activeDue) <= 3 ? "due_soon" : "on_track";
  return { ...base, state, forecast, daysLate };
}

/** Most urgent first: behind (most late first), then by the current stage's due date; requests oldest first. */
export function byUrgency(a: Project, b: Project) {
  const ha = projectHealth(a);
  const hb = projectHealth(b);
  const rank = (h: Health) => (h.state === "behind" ? 0 : h.state === "due_soon" ? 1 : h.state === "on_track" ? 2 : 3);
  return (
    rank(ha) - rank(hb) ||
    hb.daysLate - ha.daysLate ||
    (ha.active?.due_date ?? "9999").localeCompare(hb.active?.due_date ?? "9999") ||
    a.submitted_at.localeCompare(b.submitted_at)
  );
}

/** Live stages that are overdue or due within 3 working days. */
export function actionItems(projects: Project[], today = todayIso()) {
  const soon = addWorkingDays(today, 3);
  return projects
    .filter((p) => p.status === "live")
    .flatMap((p) => {
      const s = (p.project_stages ?? []).find((x) => x.status === "active");
      return s?.due_date && s.due_date <= soon ? [{ project: p, stage: s, overdue: s.due_date < today }] : [];
    })
    .sort((a, b) => a.stage.due_date!.localeCompare(b.stage.due_date!));
}

// ---------------------------------------------------------------------------
// History and pop-ups
// ---------------------------------------------------------------------------

export async function logEvent(projectId: string, actorId: string | null, kind: string, detail: Record<string, unknown> = {}) {
  await createAdminClient().from("project_events").insert({ project_id: projectId, actor_id: actorId, kind, detail });
}

export async function notify(userIds: (string | null | undefined)[], projectId: string, message: string, exceptId?: string) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x && x !== exceptId))];
  if (!ids.length) return;
  await createAdminClient().from("notifications").insert(ids.map((user_id) => ({ user_id, project_id: projectId, message })));
}

/** Everyone with one of these hub roles. */
export async function usersWithRoles(roles: HubRole[]) {
  const { data } = await createAdminClient().from("profiles").select("id, email, full_name").in("hub_role", roles).eq("active", true);
  return (data ?? []) as { id: string; email: string; full_name: string | null }[];
}

export { outletLine, projectTitle } from "@/lib/projects-shared";

// ---------------------------------------------------------------------------
// Previous investment
// ---------------------------------------------------------------------------

export type Investment = {
  /** Approved projects at this outlet (live, paused or completed). */
  outlet: { total: number; count: number; latest: { ref: string; date: string } | null };
  /** The same across every outlet of the customer (parent account). */
  group: { total: number; count: number };
  /** Requests at this outlet still waiting for approval. */
  pending: { total: number; count: number };
};

const INVESTED = ["live", "paused", "completed"];
const WAITING = ["awaiting_sm", "awaiting_cm", "awaiting_tm"];

/** What's been invested in an outlet and its customer before, leaving out one project (the one being looked at). */
export async function investmentFor(accountId: string, parentNumber: string | null, excludeId?: string): Promise<Investment> {
  const db = createAdminClient();
  let q = db.from("projects").select("id, ref, status, budget_aed, account_id, submitted_at, started_at, hidden_for_kam");
  q = parentNumber ? q.or(`account_id.eq.${accountId},parent_number.eq."${parentNumber.replace(/"/g, "")}"`) : q.eq("account_id", accountId);
  const { data } = await q.limit(2000);
  const rows = (data ?? []).filter((r) => r.id !== excludeId && !r.hidden_for_kam);
  const sum = (list: typeof rows) => list.reduce((n, r) => n + Number(r.budget_aed || 0), 0);
  const atOutlet = rows.filter((r) => r.account_id === accountId);
  const invested = atOutlet.filter((r) => INVESTED.includes(r.status as string));
  const latest = [...invested].sort((a, b) => String(b.started_at ?? b.submitted_at).localeCompare(String(a.started_at ?? a.submitted_at)))[0];
  const groupInvested = rows.filter((r) => INVESTED.includes(r.status as string));
  const waiting = atOutlet.filter((r) => WAITING.includes(r.status as string));
  return {
    outlet: { total: sum(invested), count: invested.length, latest: latest ? { ref: latest.ref as string, date: String(latest.started_at ?? latest.submitted_at) } : null },
    group: { total: sum(groupInvested), count: groupInvested.length },
    pending: { total: sum(waiting), count: waiting.length },
  };
}
