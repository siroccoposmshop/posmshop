import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminProfile } from "@/lib/hub";
import type { Profile } from "@/lib/types";

// ---------------------------------------------------------------------------
// Who, and what
// ---------------------------------------------------------------------------

/** Off trade is for Trade Marketing (TM, TMM) and admins. */
export const canUseOffTrade = (p: Pick<Profile, "role" | "hub_role">) => isAdminProfile(p);

export const OFF_TRADE_PROJECT_TYPES = ["Branding", "Perfect shelf", "Cold room", "Fridge", "FSU", "Other"] as const;
export const OFF_TRADE_STATUS: Record<OffTradeStatus, string> = { planned: "Planned", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" };
/** Segment order and short labels, as in the TM team structure deck. */
export const SEGMENTS = [
  { name: "Premium", short: "P" },
  { name: "Mainstream", short: "M" },
  { name: "Value", short: "V" },
  { name: "Industrial Retail", short: "IR" },
] as const;
export const segmentShort = (s: string | null) => SEGMENTS.find((x) => x.name.toLowerCase() === (s ?? "").toLowerCase())?.short ?? (s || "—");

/** The year targets are set for (planned projects in this year are the targets). */
export const TARGET_YEAR = 2027;

export type OffTradeStatus = "planned" | "in_progress" | "completed" | "cancelled";

export type OffTradeStore = {
  id: string;
  code: string;
  name: string;
  chain: string | null;
  market: string | null;
  area: string | null;
  tmam: string | null;
  segment: string | null;
  influenced: boolean;
  visit_frequency: string | null;
  city?: string | null;
  /** Retail store, Bar … */
  store_type?: string | null;
  /** What's in the store: { asset group: { brand: quantity } } (Visibility Master File). */
  visibility?: Visibility | null;
  /** The master file's own "Visibility" Yes / No, kept for reference. */
  visibility_flag?: string | null;
  /** Targeted for this year, even before a project is chosen. */
  target_year?: number | null;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Visibility in store (the five main titles always shown; the rest in the details)
// ---------------------------------------------------------------------------

export type Visibility = Record<string, Record<string, number>>;
export const VISIBILITY_MAIN = ["Branding", "Perfect shelf", "Cold room", "Fridge", "FSU"] as const;
export type VisibilityMain = (typeof VISIBILITY_MAIN)[number] | "Other";

/** Which main title an asset group from the master file belongs to. */
export function visibilityMain(group: string): VisibilityMain {
  const g = group.toLowerCase();
  if (/perfect\s*shelf/.test(g)) return "Perfect shelf";
  if (/cold\s*room/.test(g)) return "Cold room";
  if (/fridge|chiller unit/.test(g) && !/retailer/.test(g)) return "Fridge";
  if (/\bfsu\b|floor\s*stand/.test(g)) return "FSU";
  if (/brand|light\s*box|pallet\s*wall|take\s*over|wall/.test(g)) return "Branding";
  return "Other";
}

/** Quantity per main title, and the groups behind each (for the details). */
export function visibilitySummary(v: Visibility | null | undefined) {
  const totals: Record<VisibilityMain, number> = { Branding: 0, "Perfect shelf": 0, "Cold room": 0, Fridge: 0, FSU: 0, Other: 0 };
  const groups: Record<VisibilityMain, { group: string; items: [string, number][] }[]> = { Branding: [], "Perfect shelf": [], "Cold room": [], Fridge: [], FSU: [], Other: [] };
  for (const [group, items] of Object.entries(v ?? {})) {
    const list = Object.entries(items).filter(([, q]) => q > 0);
    if (!list.length) continue;
    const main = visibilityMain(group);
    totals[main] += list.reduce((n, [, q]) => n + q, 0);
    groups[main].push({ group, items: list });
  }
  return { totals, groups, any: Object.values(totals).some((n) => n > 0) };
}

/** Market codes used for off trade (UAE and the Gulf). */
export const OFF_TRADE_MARKETS: Record<string, string> = {
  DXB: "Dubai",
  AUH: "Abu Dhabi",
  NE: "Northern Emirates",
  OM: "Oman",
  BH: "Bahrain",
  QA: "Qatar",
  DF: "Duty Free",
};
export const marketName = (code: string | null) => (code ? (OFF_TRADE_MARKETS[code] ?? code) : "—");

export type OffTradeProject = {
  id: string;
  store_id: string;
  type: string;
  status: OffTradeStatus;
  plan_year: number | null;
  planned_date: string | null;
  completed_date: string | null;
  expected_cost_aed: number | null;
  actual_cost_aed: number | null;
  notes: string | null;
  created_at: string;
};

export type StoreView = OffTradeStore & {
  projects: OffTradeProject[];
  /** The latest completed project. */
  last: OffTradeProject | null;
  /** The target year's projects (planned, in progress or already done), not cancelled. */
  targets: OffTradeProject[];
  /** A target store this year: marked as one, or with a project for the year. */
  targeted: boolean;
  /** Visibility quantities per main title. */
  vis: ReturnType<typeof visibilitySummary>;
};

export async function loadOffTrade(): Promise<StoreView[]> {
  const db = createAdminClient();
  const [{ data: stores, error }, { data: projects, error: pErr }] = await Promise.all([
    db.from("off_trade_stores").select("*").eq("active", true).order("name").limit(5000),
    db.from("off_trade_projects").select("*").limit(20000),
  ]);
  if (error || pErr) throw new Error((error ?? pErr)!.message);
  const byStore = new Map<string, OffTradeProject[]>();
  for (const p of (projects as OffTradeProject[]) ?? []) byStore.set(p.store_id, [...(byStore.get(p.store_id) ?? []), p]);
  return ((stores as OffTradeStore[]) ?? []).map((s) => storeView(s, byStore.get(s.id) ?? []));
}

export function storeView(s: OffTradeStore, projects: OffTradeProject[]): StoreView {
  const sorted = [...projects].sort((a, b) => String(b.completed_date ?? b.planned_date ?? b.created_at).localeCompare(String(a.completed_date ?? a.planned_date ?? a.created_at)));
  const done = sorted.filter((p) => p.status === "completed");
  return {
    ...s,
    projects: sorted,
    last: done.sort((a, b) => String(b.completed_date).localeCompare(String(a.completed_date)))[0] ?? null,
    targets: sorted.filter((p) => p.status !== "cancelled" && yearOf(p) === TARGET_YEAR),
    vis: visibilitySummary(s.visibility),
    targeted: s.target_year === TARGET_YEAR || sorted.some((p) => p.status !== "cancelled" && yearOf(p) === TARGET_YEAR),
  };
}

/** The year a project belongs to: its target year, else its planned or completed date. */
export function yearOf(p: OffTradeProject): number | null {
  if (p.plan_year) return p.plan_year;
  const y = Number((p.planned_date ?? p.completed_date ?? "").slice(0, 4));
  return y > 2000 ? y : null;
}

// ---------------------------------------------------------------------------
// Filters (URL; repeated keys for several)
// ---------------------------------------------------------------------------

export type OffTradeFilters = { market: string[]; area: string[]; tmam: string[]; segment: string[]; chain: string[]; type: string[]; influence?: "yes" | "no" };

export function readOffTradeFilters(sp: Record<string, string | string[] | undefined>): OffTradeFilters {
  const list = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v : v ? [v] : []).map((x) => x.trim()).filter(Boolean);
  };
  const inf = sp.influence;
  return { market: list("market"), area: list("area"), tmam: list("tmam"), segment: list("segment"), chain: list("chain"), type: list("type"), influence: inf === "yes" || inf === "no" ? inf : undefined };
}

export function applyOffTradeFilters(stores: StoreView[], f: OffTradeFilters) {
  const has = (list: string[], v: string | null) => !list.length || list.includes(v ?? "");
  return stores.filter(
    (s) =>
      has(f.market, s.market) &&
      has(f.area, s.area) &&
      has(f.tmam, s.tmam) &&
      has(f.segment, s.segment) &&
      has(f.chain, s.chain) &&
      has(f.type, s.store_type ?? null) &&
      (!f.influence || (f.influence === "yes") === s.influenced),
  );
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export type OffTradeSummary = {
  key: string;
  label: string;
  stores: number;
  influenced: number;
  segments: Record<string, number>;
  /** Stores with at least one completed project. */
  withProjects: number;
  lastDate: string | null;
  /** Stores with a project planned for the target year. */
  targeted: number;
  expected: number;
  /** Real cost of target-year projects completed so far. */
  actual: number;
  /** Expected cost of the target-year projects that are completed (to compare with actual). */
  expectedDone: number;
  /** Stores with each main visibility title in place. */
  assets: Record<string, number>;
};

function summarise(stores: StoreView[], keyOf: (s: StoreView) => string) {
  const map = new Map<string, OffTradeSummary>();
  for (const s of stores) {
    const key = keyOf(s) || "—";
    const e = map.get(key) ?? { key, label: key, stores: 0, influenced: 0, segments: {}, withProjects: 0, lastDate: null, targeted: 0, expected: 0, actual: 0, expectedDone: 0, assets: {} };
    for (const m of VISIBILITY_MAIN) if (s.vis.totals[m] > 0) e.assets[m] = (e.assets[m] ?? 0) + 1;
    e.stores++;
    if (s.influenced) e.influenced++;
    const seg = segmentShort(s.segment);
    e.segments[seg] = (e.segments[seg] ?? 0) + 1;
    if (s.last) {
      e.withProjects++;
      if (s.last.completed_date && (!e.lastDate || s.last.completed_date > e.lastDate)) e.lastDate = s.last.completed_date;
    }
    if (s.targeted) e.targeted++;
    for (const p of s.projects) {
      if (yearOf(p) !== TARGET_YEAR || p.status === "cancelled") continue;
      e.expected += Number(p.expected_cost_aed ?? 0);
      if (p.status === "completed") {
        e.actual += Number(p.actual_cost_aed ?? 0);
        e.expectedDone += Number(p.expected_cost_aed ?? 0);
      }
    }
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.stores - a.stores);
}

const EMPTY: OffTradeSummary = { key: "All", label: "All", stores: 0, influenced: 0, segments: {}, withProjects: 0, lastDate: null, targeted: 0, expected: 0, actual: 0, expectedDone: 0, assets: {} };
export const offTradeTotals = (stores: StoreView[]) => summarise(stores, () => "All")[0] ?? EMPTY;
export const byArea = (stores: StoreView[]) => summarise(stores, (s) => s.area ?? "");
export const byTmam = (stores: StoreView[]) => summarise(stores, (s) => s.tmam ?? "");
export const bySegment = (stores: StoreView[]) => summarise(stores, (s) => s.segment ?? "");
export const byMarket = (stores: StoreView[]) => summarise(stores, (s) => s.market ?? "").map((r) => ({ ...r, label: marketName(r.key === "—" ? null : r.key) }));

/** By project type: stores done (ever), last done, target-year planned, expected and actual. */
export function byProjectType(stores: StoreView[]) {
  return OFF_TRADE_PROJECT_TYPES.map((type) => {
    const done = new Set<string>();
    let last: string | null = null;
    let planned = 0;
    let expected = 0;
    let actual = 0;
    for (const s of stores) {
      for (const p of s.projects.filter((x) => x.type === type)) {
        if (p.status === "completed") {
          done.add(s.id);
          if (p.completed_date && (!last || p.completed_date > last)) last = p.completed_date;
        }
        if (yearOf(p) === TARGET_YEAR && p.status !== "cancelled") {
          if (p.status !== "completed") planned++;
          expected += Number(p.expected_cost_aed ?? 0);
          if (p.status === "completed") actual += Number(p.actual_cost_aed ?? 0);
        }
      }
    }
    return { type, storesDone: done.size, last, planned, expected, actual };
  }).filter((r) => r.storesDone || r.planned || r.expected || r.actual);
}

/** Distinct values for the filter lists. */
export function filterOptions(stores: StoreView[]) {
  const vals = (f: (s: StoreView) => string | null) => [...new Set(stores.map(f).filter((x): x is string => !!x))].sort();
  return {
    market: vals((s) => s.market),
    area: vals((s) => s.area),
    tmam: vals((s) => s.tmam),
    chain: vals((s) => s.chain),
    segment: vals((s) => s.segment),
    type: vals((s) => s.store_type ?? null),
  };
}
