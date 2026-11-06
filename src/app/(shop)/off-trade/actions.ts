"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { OFF_TRADE_PROJECT_TYPES, canUseOffTrade } from "@/lib/off-trade";
import { findVisibilityMaster, parseOffTradeWorkbook } from "@/lib/off-trade-excel";

type Result = { ok?: boolean; error?: string };
const MIGRATION = "Run supabase/migrations/20261109000000_off_trade.sql in Supabase first.";
const dbError = (m: string) =>
  /\b(item|brand|quantity)\b/.test(m)
    ? "Run supabase/migrations/20261114000000_off_trade_history.sql in Supabase first."
    : /visibility|match_key|store_type|city/.test(m)
    ? "Run supabase/migrations/20261111000000_off_trade_visibility.sql in Supabase first."
    : /target_year/.test(m)
    ? "Run supabase/migrations/20261110000000_off_trade_targets.sql in Supabase first."
    : /off_trade|does not exist|schema cache/i.test(m)
      ? MIGRATION
      : m;

async function me() {
  const p = await getProfile();
  return p?.active && canUseOffTrade(p) ? p : null;
}
const DENIED: Result = { error: "Only Trade Marketing can change off-trade records." };

function refresh(storeId?: string) {
  revalidatePath("/off-trade");
  if (storeId) revalidatePath(`/off-trade/stores/${storeId}`);
}

const money = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export type ProjectInput = {
  type: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  planYear: number | null;
  plannedDate: string | null;
  completedDate: string | null;
  expectedCost: number | string | null;
  actualCost: number | string | null;
  notes: string | null;
  item?: string | null;
  brand?: string | null;
  quantity?: number | string | null;
};

function row(input: ProjectInput) {
  if (!OFF_TRADE_PROJECT_TYPES.includes(input.type as (typeof OFF_TRADE_PROJECT_TYPES)[number])) return { error: "Choose the project type." };
  if (!["planned", "in_progress", "completed", "cancelled"].includes(input.status)) return { error: "Choose the status." };
  const completed = day(input.completedDate);
  if (input.status === "completed" && !completed) return { error: "Enter the date it was completed." };
  const planned = day(input.plannedDate);
  const year = input.planYear && input.planYear > 2000 && input.planYear < 2100 ? Math.round(input.planYear) : planned ? Number(planned.slice(0, 4)) : completed ? Number(completed.slice(0, 4)) : null;
  return {
    data: {
      type: input.type,
      status: input.status,
      plan_year: year,
      planned_date: planned,
      completed_date: input.status === "completed" ? completed : null,
      expected_cost_aed: money(input.expectedCost),
      actual_cost_aed: money(input.actualCost),
      notes: input.notes?.trim() || null,
      item: input.item?.trim() || null,
      brand: input.brand?.trim() || null,
      quantity: Math.round(Number(input.quantity)) > 0 ? Math.round(Number(input.quantity)) : null,
      updated_at: new Date().toISOString(),
    },
  };
}

export async function addOffTradeProject(storeId: string, input: ProjectInput): Promise<Result> {
  const profile = await me();
  if (!profile) return DENIED;
  const r = row(input);
  if ("error" in r) return { error: r.error };
  const { error } = await createAdminClient().from("off_trade_projects").insert({ ...r.data, store_id: storeId, created_by: profile.id });
  if (error) return { error: dbError(error.message) };
  refresh(storeId);
  return { ok: true };
}

export async function updateOffTradeProject(id: string, input: ProjectInput): Promise<Result> {
  const profile = await me();
  if (!profile) return DENIED;
  const r = row(input);
  if ("error" in r) return { error: r.error };
  const { data, error } = await createAdminClient().from("off_trade_projects").update(r.data).eq("id", id).select("store_id").single();
  if (error) return { error: dbError(error.message) };
  refresh(data.store_id as string);
  return { ok: true };
}

export async function deleteOffTradeProject(id: string): Promise<Result> {
  const profile = await me();
  if (!profile) return DENIED;
  const { data, error } = await createAdminClient().from("off_trade_projects").delete().eq("id", id).select("store_id").single();
  if (error) return { error: dbError(error.message) };
  refresh(data.store_id as string);
  return { ok: true };
}

/** Mark a store as a target for the year (or not), before a project is chosen. */
export async function setStoreTarget(storeId: string, year: number | null): Promise<Result> {
  const profile = await me();
  if (!profile) return DENIED;
  const { error } = await createAdminClient().from("off_trade_stores").update({ target_year: year, updated_at: new Date().toISOString() }).eq("id", storeId);
  if (error) return { error: dbError(error.message) };
  refresh(storeId);
  return { ok: true };
}

export type OffTradeImportSummary = { stores: number; created: number; projects: number; unknownStores: string[]; warnings: string[] };

/** Stores are upserted by store code; projects from the Projects sheet are upserted by a key from their columns. */
export async function importOffTrade(input: { path: string; filename: string }): Promise<{ summary?: OffTradeImportSummary; error?: string }> {
  const profile = await me();
  if (!profile) return DENIED;
  if (!input.filename.toLowerCase().endsWith(".xlsx")) return { error: "Please upload an .xlsx file." };
  const db = createAdminClient();
  const { data: blob, error: dl } = await db.storage.from("imports").download(input.path);
  if (dl || !blob) return { error: "The uploaded file couldn't be found. Please try again." };
  const buffer = await blob.arrayBuffer();

  // The Visibility Master File (Off Trade Gulf Store List): stores and what's in them.
  let master;
  try {
    master = await findVisibilityMaster(buffer);
  } catch {
    return { error: "That file couldn't be read. Is it a valid .xlsx workbook?" };
  }
  if (master) return importVisibilityMaster(master);

  let parsed;
  try {
    parsed = await parseOffTradeWorkbook(buffer);
  } catch {
    return { error: "That file couldn't be read. Is it a valid .xlsx workbook?" };
  }
  if (!parsed.stores.length && !parsed.projects.length) return { error: parsed.warnings[0] ?? "No stores or projects found in the file." };

  const { data: existing, error: exErr } = await db.from("off_trade_stores").select("id, code");
  if (exErr) return { error: dbError(exErr.message) };
  const before = new Set((existing ?? []).map((s) => (s.code as string).toUpperCase()));
  const now = new Date().toISOString();
  // Columns missing from the sheet aren't sent, so they keep what was set on the site (e.g. a target).
  const keep = new Set(["code", "name", ...parsed.storeColumns]);
  const storeRows = parsed.stores.map((s) => ({
    ...Object.fromEntries(Object.entries(s).filter(([k]) => keep.has(k) || (k === "influenced" && keep.has("influenced")))),
    active: true,
    updated_at: now,
  }));
  for (let i = 0; i < storeRows.length; i += 500) {
    const { error } = await db.from("off_trade_stores").upsert(storeRows.slice(i, i + 500), { onConflict: "code" });
    if (error) return { error: dbError(error.message) };
  }

  const { data: all } = await db.from("off_trade_stores").select("id, code, name, chain");
  const idByCode = new Map((all ?? []).map((s) => [(s.code as string).toUpperCase(), s.id as string]));
  // No store code yet: match on store name (and chain, if given) when that's unambiguous.
  const n = (x: string | null | undefined) => (x ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const byName = new Map<string, string[]>();
  for (const st of all ?? []) {
    for (const k of [n(st.name as string), `${n(st.chain as string)}|${n(st.name as string)}`]) byName.set(k, [...(byName.get(k) ?? []), st.id as string]);
  }
  const findStore = (p: { code: string; name: string | null; chain: string | null }) => {
    if (p.code && idByCode.has(p.code.toUpperCase())) return idByCode.get(p.code.toUpperCase());
    if (!p.name) return undefined;
    const hits = (p.chain && byName.get(`${n(p.chain)}|${n(p.name)}`)) || byName.get(n(p.name)) || [];
    return hits.length === 1 ? hits[0] : undefined;
  };
  const unknown = new Set<string>();
  const projectRows = parsed.projects.flatMap((p) => {
    const storeId = findStore(p);
    if (!storeId) {
      unknown.add(p.code || p.name || "?");
      return [];
    }
    const { code: _c, name: _n, chain: _ch, ...rest } = p;
    const key = [storeId, p.type, p.item ?? "", p.brand ?? "", p.plan_year ?? "", p.planned_date ?? "", p.completed_date ?? ""].join("|").toLowerCase();
    return [{ ...rest, store_id: storeId, import_key: key, created_by: profile.id, updated_at: now }];
  });
  // The same key twice in one file: keep the last.
  const unique = [...new Map(projectRows.map((r) => [r.import_key, r])).values()];
  for (let i = 0; i < unique.length; i += 500) {
    const { error } = await db.from("off_trade_projects").upsert(unique.slice(i, i + 500), { onConflict: "import_key" });
    if (error) return { error: dbError(error.message) };
  }
  refresh();
  return {
    summary: {
      stores: parsed.stores.length,
      created: parsed.stores.filter((s) => !before.has(s.code.toUpperCase())).length,
      projects: unique.length,
      unknownStores: [...unknown].slice(0, 20),
      warnings: parsed.warnings.slice(0, 20),
    },
  };
}

/**
 * Stores from the Visibility Master File, matched on channel | customer | store | type, so the list can
 * be uploaded again (and real store codes added in a column later) without duplicates. Targets and
 * projects set on the site are kept.
 */
async function importVisibilityMaster(master: NonNullable<Awaited<ReturnType<typeof findVisibilityMaster>>>): Promise<{ summary?: OffTradeImportSummary; error?: string }> {
  const db = createAdminClient();
  const { data: existing, error: exErr } = await db.from("off_trade_stores").select("id, match_key");
  if (exErr) return { error: dbError(exErr.message) };
  const before = new Set((existing ?? []).map((s) => s.match_key as string | null).filter(Boolean));
  const now = new Date().toISOString();
  const rows = master.stores.map(({ target_year: _t, visit_frequency: _v, ...s }) => ({ ...s, active: true, updated_at: now }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from("off_trade_stores").upsert(rows.slice(i, i + 200), { onConflict: "match_key" });
    if (error) return { error: dbError(error.message) };
  }
  refresh();
  const waiting = master.stores.filter((s) => s.code.startsWith("TBC-")).length;
  return {
    summary: {
      stores: master.stores.length,
      created: master.stores.filter((s) => !before.has(s.match_key)).length,
      projects: 0,
      unknownStores: [],
      warnings: [
        `Read the "${master.sheet}" tab: ${master.groups.length} asset groups (${master.groups.join(", ")}).`,
        ...(waiting ? [`${waiting} stores are waiting for their store code (shown as TBC-…). Add a "Store code" column and upload again to set them.`] : []),
      ],
    },
  };
}
