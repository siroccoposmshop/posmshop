"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type State = { error?: string; ok?: boolean } | null;

const MIGRATION = "Run supabase/migrations/20261107000000_hub_admin.sql in Supabase first.";
const missingTable = (m: string) => /hub_settings|column .*active|does not exist|schema cache/i.test(m);
const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[^0-9.]/g, ""));

function refresh() {
  revalidatePath("/admin/projects");
  revalidatePath("/projects", "layout");
}

/** Approval thresholds and the GP per HL. */
export async function saveHubSettings(_: State, formData: FormData): Promise<State> {
  const me = await requireAdmin();
  const sm = num(formData.get("sm_approval_aed"));
  const cm = num(formData.get("cm_approval_aed"));
  const gp = num(formData.get("gp_per_hl_usd"));
  if (!(sm > 0) || !(cm > 0) || !(gp > 0)) return { error: "Enter amounts above zero." };
  if (cm < sm) return { error: "The CM/TMM threshold should be at least the SM threshold." };
  const { error } = await createAdminClient()
    .from("hub_settings")
    .upsert({ id: 1, sm_approval_aed: sm, cm_approval_aed: cm, gp_per_hl_usd: gp, updated_at: new Date().toISOString(), updated_by: me.id });
  if (error) return { error: missingTable(error.message) ? MIGRATION : error.message };
  refresh();
  return { ok: true };
}

/** One stage type: name, default working days, order, and whether new projects can use it. */
export async function saveStageType(_: State, formData: FormData): Promise<State> {
  await requireAdmin();
  const key = String(formData.get("key") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const days = Math.round(num(formData.get("default_days")));
  const sort = Math.round(num(formData.get("sort")));
  const active = formData.get("active") === "on";
  if (!key || !name) return { error: "Give the stage a name." };
  if (!(days >= 1 && days <= 250)) return { error: "Days must be 1–250." };
  const { error } = await createAdminClient().from("project_stage_types").update({ name, default_days: days, sort, active }).eq("key", key);
  if (error) return { error: missingTable(error.message) ? MIGRATION : error.message };
  refresh();
  return { ok: true };
}

export async function addStageType(_: State, formData: FormData): Promise<State> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const days = Math.round(num(formData.get("default_days")));
  const trade = formData.get("trade") === "off" ? "off" : "on";
  if (!name) return { error: "Give the stage a name." };
  if (!(days >= 1 && days <= 250)) return { error: "Days must be 1–250." };
  const db = createAdminClient();
  const base = (trade === "off" ? "ot_" : "") + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "stage";
  const { data: existing } = await db.from("project_stage_types").select("key, sort");
  const keys = new Set((existing ?? []).map((r) => r.key as string));
  let key = base;
  for (let n = 2; keys.has(key); n++) key = `${base}_${n}`;
  const sort = Math.max(0, ...(existing ?? []).map((r) => Number(r.sort) || 0)) + 1;
  const { error } = await db.from("project_stage_types").insert(trade === "off" ? { key, name, default_days: days, sort, trade } : { key, name, default_days: days, sort });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}
