"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseEmail, normaliseMobile } from "@/lib/contact";
import { formatDate } from "@/lib/format";
import { MIN_BRIEF_CHARS, PROJECT_TYPES, approvalStatus, isAdminProfile, type ProjectStatus } from "@/lib/hub";
import { loadHubSettings } from "@/lib/hub-settings";
import { OUTLET_TYPES, anyNegotiated, otherOutletsWithTicks, picosScores, type Picos } from "@/lib/picos";
import { addWorkingDays, dubaiDate, planStages, todayIso } from "@/lib/working-days";
import {
  canApprove,
  hubRole,
  investmentFor,
  isProjectAdmin,
  loadPeople,
  loadProject,
  logEvent,
  notify,
  personName,
  projectTitle,
  usersWithRoles,
  type Investment,
  type Project,
} from "@/lib/projects";
import { renderProjectEmail, sendProjectEmail, type ProjectEmailKind } from "@/lib/project-emails";

type Result = { ok?: boolean; error?: string; id?: string };

async function me() {
  const p = await getProfile();
  return p?.active ? p : null;
}
const SIGNED_OUT: Result = { error: "You've been signed out. Sign in again and retry." };

function refresh(id?: string) {
  revalidatePath("/projects");
  revalidatePath("/");
  if (id) revalidatePath(`/projects/${id}`);
}

async function emailAbout(kind: ProjectEmailKind, projectId: string, to: (string | null | undefined)[], extra: { reason?: string; stage?: string } = {}) {
  const { data } = await createAdminClient().from("projects").select("*, project_stages(*)").eq("id", projectId).single();
  if (!data) return;
  const p = { ...(data as Project), project_stages: [...((data as Project).project_stages ?? [])].sort((a, b) => a.sort - b.sort) };
  const [people, settings, investment] = await Promise.all([
    loadPeople(),
    loadHubSettings(),
    kind === "approval_needed" && p.account_id ? investmentFor(p.account_id, p.parent_number, p.id) : Promise.resolve(undefined),
  ]);
  const email = renderProjectEmail(kind, p, { kam: personName(people.get(p.kam_id)), sm: p.sm_id ? personName(people.get(p.sm_id)) : undefined, tm: p.tm_id ? personName(people.get(p.tm_id)) : undefined }, { ...extra, investment }, settings);
  const kamEmail = people.get(p.kam_id)?.email;
  await sendProjectEmail(to, email, kind === "approval_needed" ? kamEmail : undefined);
}

/** Who approves next, by status: the SM (or CM/TMM if the KAM has no SM), CM/TMM, or Trade Marketing. */
async function approversFor(status: ProjectStatus, smId: string | null) {
  if (status === "awaiting_sm" && smId) {
    const { data } = await createAdminClient().from("profiles").select("id, email").eq("id", smId).single();
    return data ? [data as { id: string; email: string }] : [];
  }
  if (status === "awaiting_sm" || status === "awaiting_cm") return usersWithRoles(["cm", "tmm"]);
  if (status === "awaiting_tm") return usersWithRoles(["tm", "tmm"]);
  return [];
}

async function announceNextStep(p: { id: string; status: ProjectStatus; sm_id: string | null; account_name: string }, actorId: string) {
  const people = await approversFor(p.status, p.sm_id);
  const msg =
    p.status === "awaiting_tm"
      ? `New project request for ${p.account_name} is ready to vet.`
      : `A project request for ${p.account_name} needs your approval.`;
  await notify(people.map((x) => x.id), p.id, msg, actorId);
  if (p.status !== "awaiting_tm") await emailAbout("approval_needed", p.id, people.map((x) => x.email));
}

// ---------------------------------------------------------------------------
// Briefing form
// ---------------------------------------------------------------------------

export type BriefInput = {
  projectId?: string;
  accountId: string;
  projectType: string;
  brands: string[];
  outletType: string;
  contact: { name: string; mobile: string; email: string };
  budgetBif: number;
  budgetExtra: number | null;
  budgetExtraSource: "sirocco" | "other" | null;
  brief: string;
  volumeBudget: number | null;
  incrementalVolume: number | null;
  desiredDate: string;
  picos: Picos;
};

export async function submitBrief(input: BriefInput): Promise<Result & { fieldErrors?: Record<string, string> }> {
  const profile = await me();
  if (!profile) return SIGNED_OUT;
  const db = createAdminClient();

  const errors: Record<string, string> = {};
  const { data: account } = await db.from("accounts").select("*").eq("id", input.accountId).maybeSingle();
  if (!account) errors.account = "Choose the customer and outlet.";
  else if (!isProjectAdmin(profile) && !isAdminProfile(profile) && profile.market && account.market !== profile.market) errors.account = "That outlet isn't in your market.";
  if (!PROJECT_TYPES.includes(input.projectType as (typeof PROJECT_TYPES)[number])) errors.projectType = "Choose the project type.";
  if (!input.brands?.length) errors.brands = "Choose at least one brand.";
  if (!OUTLET_TYPES.includes(input.outletType as (typeof OUTLET_TYPES)[number])) errors.outletType = "Choose the outlet type.";
  const mobile = normaliseMobile(input.contact?.mobile ?? "");
  const email = normaliseEmail(input.contact?.email ?? "");
  if (!input.contact?.name?.trim()) errors.contactName = "Enter the contact's name.";
  if (!mobile.ok) errors.contactMobile = mobile.error;
  if (!email.ok) errors.contactEmail = email.error;
  const bif = Number(input.budgetBif) || 0;
  const extra = Number(input.budgetExtra) || 0;
  const extraSource = extra > 0 ? input.budgetExtraSource : null;
  if (!(bif > 0)) errors.budget = "Enter the BIF value in AED.";
  if (extra < 0) errors.budgetExtra = "Enter a positive amount.";
  else if (extra > 0 && extraSource !== "sirocco" && extraSource !== "other") errors.budgetExtra = "Choose Sirocco or Other for the extra funding.";
  const budget = bif + Math.max(0, extra);
  if ((input.brief ?? "").trim().length < MIN_BRIEF_CHARS) errors.brief = `Describe the project in at least ${MIN_BRIEF_CHARS} characters.`;
  if (input.volumeBudget === null || !(input.volumeBudget >= 0)) errors.volumeBudget = "Enter the 2027 volume budget in HL.";
  if (input.incrementalVolume === null || !(input.incrementalVolume >= 0)) errors.incrementalVolume = "Enter the incremental volume in HL.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.desiredDate ?? "") || input.desiredDate <= todayIso()) errors.desiredDate = "Choose a date in the future.";
  // Other outlets: only those under the same customer, with something ticked.
  if (account && input.picos?.others) {
    const entries = otherOutletsWithTicks(input.picos);
    const ids = entries.map(([id]) => id).filter((id) => id !== account.id);
    const { data: siblings } = ids.length
      ? await db.from("accounts").select("id, account_number, name").in("id", ids).eq("parent_number", account.parent_number)
      : { data: [] };
    const ok = new Map((siblings ?? []).map((r) => [r.id as string, r]));
    input.picos = {
      ...input.picos,
      others: Object.fromEntries(
        entries
          .filter(([id]) => ok.has(id))
          .map(([id, o]) => [id, { account_number: ok.get(id)!.account_number as string, name: ok.get(id)!.name as string, outlet_type: o.outlet_type, items: o.items }]),
      ),
    };
  }
  if (!errors.outletType && !anyNegotiated(input.outletType, input.picos)) errors.picos = "Tick at least one PICOS change negotiated in this deal (at this outlet or another one).";
  if (Object.keys(errors).length) return { error: "Please complete the highlighted sections.", fieldErrors: errors };

  // Re-submitting a request that was sent back.
  let existing: Project | null = null;
  if (input.projectId) {
    existing = await loadProject(input.projectId, profile);
    if (!existing || existing.kam_id !== profile.id || !["rejected", "awaiting_sm", "awaiting_cm", "awaiting_tm"].includes(existing.status)) {
      return { error: "This request can no longer be edited." };
    }
  }

  const kamId = existing?.kam_id ?? profile.id;
  const { data: kam } = await db.from("profiles").select("id, hub_role, manager_id").eq("id", kamId).single();
  const submitterIsSm = hubRole(profile) === "sm";
  const smId = submitterIsSm ? profile.id : ((kam?.manager_id as string | null) ?? null);
  const status: ProjectStatus = approvalStatus(budget, submitterIsSm, await loadHubSettings());
  const scores = picosScores(input.outletType, input.picos);
  const now = new Date().toISOString();

  const row = {
    status,
    kam_id: kamId,
    sm_id: smId,
    account_id: account.id,
    account_number: account.account_number,
    account_name: account.name,
    parent_number: account.parent_number,
    parent_name: account.parent_name,
    market: account.market,
    project_type: input.projectType,
    brands: input.brands,
    outlet_type: input.outletType,
    contact_name: input.contact.name.trim(),
    contact_mobile: mobile.ok ? mobile.value : "",
    contact_email: email.ok ? email.value : "",
    budget_aed: budget,
    budget_bif: bif,
    budget_extra: extra > 0 ? extra : null,
    budget_extra_source: extraSource,
    brief: input.brief.trim(),
    volume_budget_hl: input.volumeBudget,
    incremental_volume_hl: input.incrementalVolume,
    desired_date: input.desiredDate,
    picos: input.picos,
    picos_score_current: scores.current,
    picos_score_promised: scores.promised,
    rejection_reason: null,
    submitted_at: now,
    sm_approved_at: submitterIsSm ? now : null,
    sm_approved_by: submitterIsSm ? profile.id : null,
    cm_approved_at: null,
    cm_approved_by: null,
    updated_at: now,
  };
  const saved = existing
    ? await db.from("projects").update(row).eq("id", existing.id).select("id").single()
    : await db.from("projects").insert(row).select("id").single();
  if (saved.error) {
    if (/budget_bif|budget_extra/.test(saved.error.message)) return { error: "Run supabase/migrations/20261106000000_budget_split.sql in Supabase first." };
    return { error: /relation .*projects|does not exist/.test(saved.error.message) ? "Run supabase/migrations/20261104000000_commerce_hub.sql in Supabase first." : saved.error.message };
  }
  const id = saved.data.id as string;

  // Save the contact for next time (shared with POSM Shop).
  await db.from("contacts").upsert({ account_id: account.id, name: row.contact_name, mobile: row.contact_mobile, email: row.contact_email, created_by: profile.id }, { onConflict: "account_id,email" });

  await logEvent(id, profile.id, existing ? "resubmitted" : "submitted", { status, budget });
  await announceNextStep({ id, status, sm_id: smId, account_name: account.name }, profile.id);
  refresh(id);
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export async function approveProject(id: string): Promise<Result> {
  const profile = await me();
  if (!profile) return SIGNED_OUT;
  const p = await loadProject(id, profile);
  if (!p || !canApprove(profile, p)) return { error: "You can't approve this request." };
  const now = new Date().toISOString();
  const { cmApprovalAed } = await loadHubSettings();
  const next: ProjectStatus = p.status === "awaiting_sm" && p.budget_aed >= cmApprovalAed ? "awaiting_cm" : "awaiting_tm";
  const patch =
    p.status === "awaiting_sm"
      ? { status: next, sm_approved_at: now, sm_approved_by: profile.id, updated_at: now }
      : { status: next, cm_approved_at: now, cm_approved_by: profile.id, updated_at: now };
  const { error } = await createAdminClient().from("projects").update(patch).eq("id", id).eq("status", p.status);
  if (error) return { error: error.message };
  await logEvent(id, profile.id, p.status === "awaiting_sm" ? "approved_sm" : "approved_cm");
  await notify([p.kam_id], id, `${personName(profile)} approved your request for ${p.account_name}.`, profile.id);
  await announceNextStep({ id, status: next, sm_id: p.sm_id, account_name: p.account_name }, profile.id);
  refresh(id);
  return { ok: true };
}

export async function sendBack(id: string, reason: string): Promise<Result> {
  const profile = await me();
  if (!profile) return SIGNED_OUT;
  const p = await loadProject(id, profile);
  if (!p || !(canApprove(profile, p) || (isProjectAdmin(profile) && p.status === "awaiting_tm"))) return { error: "You can't send this request back." };
  if (reason.trim().length < 10) return { error: "Tell the project lead what to change (at least 10 characters)." };
  const { error } = await createAdminClient()
    .from("projects")
    .update({ status: "rejected", rejection_reason: reason.trim(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  await logEvent(id, profile.id, "sent_back", { reason: reason.trim() });
  await notify([p.kam_id], id, `Your request for ${p.account_name} was sent back: ${reason.trim()}`, profile.id);
  const people = await loadPeople();
  await emailAbout("sent_back", id, [people.get(p.kam_id)?.email], { reason: reason.trim() });
  refresh(id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Trade Marketing: run and move through stages
// ---------------------------------------------------------------------------

export async function runProject(id: string, input: { name: string; tmId: string; stages: { key: string; days: number }[] }): Promise<Result> {
  const profile = await me();
  if (!profile) return SIGNED_OUT;
  if (!isProjectAdmin(profile)) return { error: "Only Trade Marketing can run projects." };
  const p = await loadProject(id, profile);
  if (!p || p.status !== "awaiting_tm") return { error: "This project isn't waiting to be run." };
  if (p.hidden_for_kam) return { error: "The project lead deleted this project. Reallocate it to a project lead first." };
  if (input.name.trim().length < 3) return { error: "Give the project a name." };
  if (!input.stages.length) return { error: "Choose at least one stage." };

  const db = createAdminClient();
  const { data: types } = await db.from("project_stage_types").select("*").order("sort");
  const byKey = new Map((types ?? []).map((t) => [t.key as string, t]));
  const chosen = input.stages
    .filter((s) => byKey.has(s.key))
    .map((s) => ({ key: s.key, name: byKey.get(s.key)!.name as string, sort: byKey.get(s.key)!.sort as number, days: Math.max(1, Math.round(s.days)) }))
    .sort((a, b) => a.sort - b.sort);
  const today = todayIso();
  const planned = planStages(today, chosen);
  const now = new Date().toISOString();

  await db.from("project_stages").delete().eq("project_id", id);
  const { error: sErr } = await db.from("project_stages").insert(
    planned.map((s, i) => ({
      project_id: id,
      key: s.key,
      name: s.name,
      sort: s.sort,
      days: s.days,
      due_date: s.due_date,
      status: i === 0 ? "active" : "pending",
      started_at: i === 0 ? now : null,
    })),
  );
  if (sErr) return { error: sErr.message };
  const { error } = await db
    .from("projects")
    .update({ status: "live", name: input.name.trim(), tm_id: input.tmId || profile.id, target_date: planned.at(-1)!.due_date, started_at: now, updated_at: now })
    .eq("id", id);
  if (error) return { error: error.message };

  await logEvent(id, profile.id, "started", { stages: chosen.map((s) => s.key), target: planned.at(-1)!.due_date });
  await notify([p.kam_id, p.sm_id], id, `${input.name.trim()} has started. First stage: ${planned[0].name}.`, profile.id);
  const people = await loadPeople();
  await emailAbout("started", id, [people.get(p.kam_id)?.email, p.sm_id ? people.get(p.sm_id)?.email : null]);
  refresh(id);
  return { ok: true };
}

/** Makes `stageKey` the current stage: earlier stages are done, later ones re-planned from it. */
export async function moveToStage(id: string, stageKey: string): Promise<Result> {
  const profile = await me();
  if (!profile) return SIGNED_OUT;
  if (!isProjectAdmin(profile)) return { error: "Only Trade Marketing can move stages." };
  const p = await loadProject(id, profile);
  if (!p || p.status !== "live") return { error: "Only live projects can move stage." };
  const stages = p.project_stages ?? [];
  const target = stages.findIndex((s) => s.key === stageKey);
  const current = stages.findIndex((s) => s.status === "active");
  if (target < 0 || target === current) return { ok: true };

  const now = new Date().toISOString();
  const today = todayIso();
  const targetDue = addWorkingDays(today, stages[target].days);
  const later = planStages(targetDue, stages.slice(target + 1));
  const db = createAdminClient();
  const updates = stages.map((s, i) => {
    if (i < target) return { id: s.id, status: "done", completed_at: s.completed_at ?? now, started_at: s.started_at ?? now, due_date: s.due_date };
    if (i === target) return { id: s.id, status: "active", completed_at: null, started_at: now, due_date: targetDue };
    return { id: s.id, status: "pending", completed_at: null, started_at: null, due_date: later[i - target - 1].due_date };
  });
  for (const u of updates) {
    const { id: sid, ...patch } = u;
    const { error } = await db.from("project_stages").update(patch).eq("id", sid);
    if (error) return { error: error.message };
  }
  await db.from("projects").update({ updated_at: now }).eq("id", id);

  const forward = target > current;
  await logEvent(id, profile.id, "stage", { from: stages[current]?.key ?? null, to: stageKey });
  if (forward) {
    await notify([p.kam_id, p.sm_id], id, `${projectTitle(p)} has moved to ${stages[target].name}.`, profile.id);
    const people = await loadPeople();
    await emailAbout("stage_moved", id, [people.get(p.kam_id)?.email], { stage: stages[target].name });
  }
  refresh(id);
  return { ok: true };
}

export async function completeProject(id: string, finalCost: number): Promise<Result> {
  const profile = await me();
  if (!profile) return SIGNED_OUT;
  if (!isProjectAdmin(profile)) return { error: "Only Trade Marketing can complete projects." };
  const p = await loadProject(id, profile);
  if (!p || p.status !== "live") return { error: "Only live projects can be completed." };
  const cost = Math.round(Number(finalCost) * 100) / 100;
  if (!Number.isFinite(cost) || cost < 0 || cost > 100_000_000) return { error: "Enter the final cost in AED." };
  const now = new Date().toISOString();
  const db = createAdminClient();
  // Save the final cost first, so a missing column stops before anything changes.
  const saved = await db.from("projects").update({ final_cost_aed: cost }).eq("id", id);
  if (saved.error) return { error: /final_cost/.test(saved.error.message) ? "Run supabase/migrations/20261108000000_final_cost.sql in Supabase first." : saved.error.message };
  for (const s of p.project_stages ?? []) {
    if (s.status !== "done") await db.from("project_stages").update({ status: "done", completed_at: now, started_at: s.started_at ?? now }).eq("id", s.id);
  }
  await db.from("projects").update({ status: "completed", completed_at: now, updated_at: now }).eq("id", id);
  await logEvent(id, profile.id, "completed", { final_cost: cost, budget: p.budget_aed });
  await notify([p.kam_id, p.sm_id], id, `${projectTitle(p)} is complete.`, profile.id);
  const people = await loadPeople();
  await emailAbout("completed", id, [people.get(p.kam_id)?.email, p.sm_id ? people.get(p.sm_id)?.email : null]);
  refresh(id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

async function adminUpdate(
  id: string,
  kind: string,
  patch: Record<string, unknown>,
  detail: Record<string, unknown> = {},
  allowed?: ProjectStatus[],
): Promise<{ profile: Awaited<ReturnType<typeof me>>; p: Project | null; result: Result }> {
  const profile = await me();
  if (!profile) return { profile: null, p: null, result: SIGNED_OUT };
  if (!isProjectAdmin(profile)) return { profile, p: null, result: { error: "Only Trade Marketing can do this." } };
  const p = await loadProject(id, profile);
  if (!p) return { profile, p: null, result: { error: "Project not found." } };
  if (allowed && !allowed.includes(p.status)) return { profile, p, result: { error: "Not possible at this stage." } };
  const { error } = await createAdminClient().from("projects").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { profile, p, result: { error: error.message } };
  await logEvent(id, profile.id, kind, detail);
  refresh(id);
  return { profile, p, result: { ok: true } as Result };
}

export async function setPaused(id: string, paused: boolean): Promise<Result> {
  const { profile, p, result } = await adminUpdate(
    id,
    paused ? "paused" : "resumed",
    paused ? { status: "paused", paused_at: new Date().toISOString() } : { status: "live", paused_at: null },
    {},
    paused ? ["live"] : ["paused"],
  );
  if (result.ok && p && profile) await notify([p.kam_id, p.sm_id], id, `${projectTitle(p)} has been ${paused ? "paused" : "resumed"}.`, profile.id);
  return result;
}

export async function cancelProject(id: string, reason: string): Promise<Result> {
  const { profile, p, result } = await adminUpdate(id, "cancelled", { status: "cancelled", cancelled_at: new Date().toISOString() }, { reason });
  if (result.ok && p && profile) await notify([p.kam_id, p.sm_id], id, `${projectTitle(p)} has been cancelled.`, profile.id);
  return result;
}

export async function reallocateProject(id: string, kamId: string): Promise<Result> {
  const db = createAdminClient();
  const { data: kam } = await db.from("profiles").select("id, manager_id, full_name, email").eq("id", kamId).maybeSingle();
  if (!kam) return { error: "Choose a project lead." };
  const { profile, p, result } = await adminUpdate(id, "reallocated", { kam_id: kamId, sm_id: kam.manager_id ?? null, hidden_for_kam: false }, { to: kamId });
  if (result.ok && p && profile) await notify([kamId], id, `${projectTitle(p)} has been passed to you.`, profile.id);
  return result;
}

export async function setOwner(id: string, tmId: string): Promise<Result> {
  const { profile, p, result } = await adminUpdate(id, "owner", { tm_id: tmId }, { to: tmId });
  if (result.ok && p && profile) await notify([tmId], id, `You now own ${projectTitle(p)}.`, profile.id);
  return result;
}

/** A KAM removes a project from their own view. It stays in the system for everyone else. */
export async function hideForMe(id: string): Promise<Result> {
  const profile = await me();
  if (!profile) return SIGNED_OUT;
  const { data: p } = await createAdminClient().from("projects").select("id, kam_id").eq("id", id).maybeSingle();
  if (!p || p.kam_id !== profile.id) return { error: "You can only remove your own projects." };
  await createAdminClient().from("projects").update({ hidden_for_kam: true }).eq("id", id);
  await logEvent(id, profile.id, "hidden_by_kam");
  refresh(id);
  return { ok: true };
}

/** SMs and Trade Marketing tick off promised PICOS once they're in place at the outlet. */
export async function togglePicosDelivered(id: string, key: string, outletId?: string): Promise<Result> {
  const profile = await me();
  if (!profile) return SIGNED_OUT;
  if (!(isProjectAdmin(profile) || hubRole(profile) === "sm")) return { error: "Only Sales Managers and Trade Marketing can update this." };
  const p = await loadProject(id, profile);
  if (!p) return { error: "Project not found." };
  const other = outletId ? p.picos.others?.[outletId] : undefined;
  if (outletId && !other) return { error: "That outlet isn't part of this project." };
  const items = other ? other.items : p.picos.items;
  const item = items?.[key];
  if (!item?.promised) return { error: "That item wasn't promised." };
  const delivered_at = item.delivered_at ? null : new Date().toISOString();
  const nextItems = { ...items, [key]: { ...item, delivered_at } };
  const picos: Picos =
    other && outletId
      ? { ...p.picos, others: { ...p.picos.others, [outletId]: { ...other, items: nextItems } } }
      : { ...p.picos, items: nextItems };
  await createAdminClient().from("projects").update({ picos }).eq("id", id);
  await logEvent(id, profile.id, delivered_at ? "picos_delivered" : "picos_undelivered", { key, ...(other ? { outlet: other.name } : {}) });
  refresh(id);
  return { ok: true };
}

export async function markNotificationsRead(ids: string[]): Promise<Result> {
  const profile = await me();
  if (!profile || !ids.length) return { ok: true };
  await createAdminClient().from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids).eq("user_id", profile.id);
  return { ok: true };
}


/**
 * Trade Marketing edits a running project's stages: done stages stay as they are, the current stage
 * can change its days (due counted from when it started), and later stages can be added, removed or
 * re-timed. Stages are re-planned and the target date moves to the new end.
 */
export async function editStages(id: string, wanted: { key: string; days: number }[]): Promise<Result> {
  const profile = await me();
  if (!profile) return SIGNED_OUT;
  if (!isProjectAdmin(profile)) return { error: "Only Trade Marketing can edit stages." };
  const p = await loadProject(id, profile);
  if (!p || !["live", "paused"].includes(p.status)) return { error: "Only live or paused projects can be edited." };

  const db = createAdminClient();
  const { data: types } = await db.from("project_stage_types").select("*").order("sort");
  const typeByKey = new Map((types ?? []).map((t) => [t.key as string, t]));
  const stages = p.project_stages ?? [];
  const active = stages.find((s) => s.status === "active");
  if (!active) return { error: "This project has no current stage." };
  const wantedDays = new Map(wanted.map((w) => [w.key, Math.max(1, Math.min(250, Math.round(w.days)))]));
  if (!wantedDays.has(active.key)) return { error: "The current stage can't be removed." };
  for (const k of wantedDays.keys()) {
    const t = typeByKey.get(k);
    if (!t) return { error: "Unknown stage." };
    const existing = stages.find((s) => s.key === k);
    if (!existing && (t.sort as number) < active.sort) return { error: `${t.name} comes before the current stage, so it can't be added now.` };
  }

  // Current stage: due counted from when it started. Later stages follow on from it.
  const activeDays = wantedDays.get(active.key)!;
  const activeDue = addWorkingDays(dubaiDate(active.started_at ?? new Date()), activeDays);
  const upcoming = [...wantedDays.keys()]
    .filter((k) => (typeByKey.get(k)!.sort as number) > active.sort)
    .map((k) => ({ key: k, name: typeByKey.get(k)!.name as string, sort: typeByKey.get(k)!.sort as number, days: wantedDays.get(k)! }))
    .sort((a, b) => a.sort - b.sort);
  // If the current stage is already late, the rest can only start from today.
  const today = todayIso();
  const planned = planStages(activeDue < today ? today : activeDue, upcoming);
  const target = planned.at(-1)?.due_date ?? activeDue;

  const removed = stages.filter((s) => s.status === "pending" && !wantedDays.has(s.key));
  const added = planned.filter((s) => !stages.some((x) => x.key === s.key));
  if (removed.length) await db.from("project_stages").delete().in("id", removed.map((s) => s.id));
  const { error: aErr } = await db.from("project_stages").update({ days: activeDays, due_date: activeDue }).eq("id", active.id);
  if (aErr) return { error: aErr.message };
  for (const s of planned) {
    const existing = stages.find((x) => x.key === s.key);
    const { error } = existing
      ? await db.from("project_stages").update({ days: s.days, due_date: s.due_date, status: "pending" }).eq("id", existing.id)
      : await db.from("project_stages").insert({ project_id: id, key: s.key, name: s.name, sort: s.sort, days: s.days, due_date: s.due_date, status: "pending" });
    if (error) return { error: error.message };
  }
  await db.from("projects").update({ target_date: target, updated_at: new Date().toISOString() }).eq("id", id);

  await logEvent(id, profile.id, "stages_edited", {
    added: added.map((s) => s.key),
    removed: removed.map((s) => s.key),
    from: p.target_date,
    to: target,
  });
  if (target !== p.target_date || added.length || removed.length) {
    await notify([p.kam_id, p.sm_id], id, `${projectTitle(p)}: stages updated. Expected completion is now ${formatDate(target)}.`, profile.id);
  }
  refresh(id);
  return { ok: true };
}

/** Previous investment in an outlet, for the brief (the KAM sees totals even for other KAMs' projects). */
export async function outletInvestment(accountId: string, excludeProjectId?: string): Promise<Investment | null> {
  const profile = await me();
  if (!profile) return null;
  const { data: account } = await createAdminClient().from("accounts").select("id, parent_number").eq("id", accountId).maybeSingle();
  if (!account) return null;
  return investmentFor(account.id as string, (account.parent_number as string | null) ?? null, excludeProjectId);
}
