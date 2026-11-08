import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Who, and what
// ---------------------------------------------------------------------------

/** Off trade is for Trade Marketing (TM, TMM) and admins. */
export { canUseOffTrade } from "@/lib/hub";

export const OFF_TRADE_PROJECT_TYPES = ["Branding", "Perfect shelf", "Cold room", "Fridge", "FSU", "Takeover", "Other"] as const;
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
  /** Set for stores from the Visibility Master File. */
  match_key?: string | null;
  city?: string | null;
  /** Retail store, Bar … */
  store_type?: string | null;
  /** What's in the store: { asset group: { brand: quantity } } (Visibility Master File). */
  visibility?: Visibility | null;
  /** The master file's own "Visibility" Yes / No, kept for reference. */
  visibility_flag?: string | null;
  /** Targeted for this year, even before a project is chosen. */
  target_year?: number | null;
  /** Set on the site; blank = as the store list says. */
  has_cold_room?: boolean | null;
  /** The year it opened; blank = before the history starts. It's an outlet from that year on. */
  opened_year?: number | null;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Visibility in store (the five main titles always shown; the rest in the details)
// ---------------------------------------------------------------------------

export type Visibility = Record<string, Record<string, number>>;
/**
 * Always shown. Takeover (Value and IR stores, bars) is an addition alongside the others. A cold room
 * is a feature of the store, not visibility: see StoreView.coldRoom.
 */
export const VISIBILITY_MAIN = ["Branding", "Perfect shelf", "Fridge", "FSU", "Takeover"] as const;
export type VisibilityMain = (typeof VISIBILITY_MAIN)[number] | "Cold room" | "Other";
/** Logged on the store but not counted as visibility (so they don't make a store influenced). */
export const NOT_VISIBILITY = /t-?\s*shirt/i;

/** Which main title an asset group from the master file belongs to. */
export function visibilityMain(group: string): VisibilityMain {
  const g = group.toLowerCase();
  if (/perfect\s*shelf/.test(g)) return "Perfect shelf";
  if (/cold\s*room/.test(g)) return "Cold room";
  if (/fridge|chiller unit/.test(g) && !/retailer/.test(g)) return "Fridge";
  if (/\bfsu\b|floor\s*stand/.test(g)) return "FSU";
  if (/take\s*over/.test(g)) return "Takeover";
  if (/brand|light\s*box|pallet\s*wall|wall/.test(g)) return "Branding";
  return "Other";
}

/** Quantity per main title, and the groups behind each (for the details). */
export function visibilitySummary(v: Visibility | null | undefined) {
  const totals: Record<VisibilityMain, number> = { Branding: 0, "Perfect shelf": 0, "Cold room": 0, Fridge: 0, FSU: 0, Takeover: 0, Other: 0 };
  const groups: Record<VisibilityMain, { group: string; items: [string, number][]; logged?: boolean }[]> = {
    Branding: [],
    "Perfect shelf": [],
    "Cold room": [],
    Fridge: [],
    FSU: [],
    Takeover: [],
    Other: [],
  };
  let counted = 0;
  let coldRoom = false;
  for (const [group, items] of Object.entries(v ?? {})) {
    const list = Object.entries(items).filter(([, q]) => q > 0);
    if (!list.length) continue;
    const main = visibilityMain(group);
    // The store has a cold room: a feature, not visibility of ours.
    if (main === "Cold room") {
      coldRoom = true;
      continue;
    }
    const logged = NOT_VISIBILITY.test(group);
    const qty = list.reduce((n, [, q]) => n + q, 0);
    if (!logged) {
      totals[main] += qty;
      counted += qty;
    }
    groups[main].push({ group, items: list, logged });
  }
  /** Any visibility that counts (T-shirts are logged only). */
  return { totals, groups, any: counted > 0, coldRoom };
}

/** Market codes used for off trade (UAE and the Gulf). */
export const OFF_TRADE_MARKETS: Record<string, string> = {
  DXB: "Dubai",
  AUH: "Abu Dhabi",
  NE: "Northern Emirates",
  OM: "Oman",
  BH: "Bahrain",
  QA: "Qatar",
};
export const marketName = (code: string | null) => (code ? (OFF_TRADE_MARKETS[code] ?? code) : "—");

export type OffTradeProject = {
  id: string;
  store_id: string;
  type: string;
  /** What exactly, e.g. Wall Branding, Light box, Cold units. */
  item?: string | null;
  brand?: string | null;
  /** How many were installed (1 if not given). */
  quantity?: number | null;
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
  /** The store has a cold room (set on the site, else the store list, else a cold room project). */
  coldRoom: boolean;
  /** Its cold room has been activated (a completed cold room project): the date, or null. */
  coldRoomActivated: string | null;
  /** The latest completed project. */
  last: OffTradeProject | null;
  /** The target year's projects (planned, in progress or already done), not cancelled. */
  targets: OffTradeProject[];
  /** A target store this year: marked as one, or with a project for the year. */
  targeted: boolean;
  /** Visibility quantities per main title. */
  vis: ReturnType<typeof visibilitySummary>;
  /** A bar inside a store: an addition, not counted as a store. */
  bar: boolean;
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

/** Bars are inside a (Value) store: an addition, not a store in the universe. */
export const isBar = (s: Pick<OffTradeStore, "store_type">) => /\bbar\b/i.test(s.store_type ?? "");

export function storeView(s: OffTradeStore, projects: OffTradeProject[]): StoreView {
  const vis = visibilitySummary(s.visibility);
  const sorted = [...projects].sort((a, b) => String(b.completed_date ?? b.planned_date ?? b.created_at).localeCompare(String(a.completed_date ?? a.planned_date ?? a.created_at)));
  const done = sorted.filter((p) => p.status === "completed");
  return {
    ...s,
    projects: sorted,
    last: done.sort((a, b) => String(b.completed_date).localeCompare(String(a.completed_date)))[0] ?? null,
    targets: sorted.filter((p) => p.status !== "cancelled" && yearOf(p) === TARGET_YEAR),
    vis,
    // Master-file stores: influenced = visibility that counts (not T-shirts). Others keep the upload's flag.
    influenced: s.match_key ? vis.any : s.influenced,
    bar: isBar(s),
    coldRoom: s.has_cold_room ?? (vis.coldRoom || projects.some((p) => p.type === "Cold room" && p.status !== "cancelled")),
    coldRoomActivated: done.filter((p) => p.type === "Cold room").map((p) => p.completed_date ?? p.created_at.slice(0, 10)).sort().at(-1) ?? null,
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

/** The filters as a query string (for links between the dashboards). */
export function offTradeQuery(f: OffTradeFilters) {
  const q = new URLSearchParams();
  for (const k of ["market", "area", "tmam", "segment", "chain", "type"] as const) for (const v of f[k]) q.append(k, v);
  if (f.influence) q.set("influence", f.influence);
  return q.toString();
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
  /** Bars (inside stores, not counted as stores). */
  bars: number;
  /** Bars with visibility. */
  barsInfluenced: number;
};

function summarise(stores: StoreView[], keyOf: (s: StoreView) => string) {
  const map = new Map<string, OffTradeSummary>();
  for (const s of stores) {
    const key = keyOf(s) || "—";
    const e = map.get(key) ?? { key, label: key, stores: 0, influenced: 0, segments: {}, withProjects: 0, lastDate: null, targeted: 0, expected: 0, actual: 0, expectedDone: 0, assets: {}, bars: 0, barsInfluenced: 0 };
    if (s.bar) {
      // An addition inside a store: counted on its own, not in the universe, mix or influence.
      e.bars++;
      if (s.influenced) e.barsInfluenced++;
    } else {
      for (const m of VISIBILITY_MAIN) if (s.vis.totals[m] > 0) e.assets[m] = (e.assets[m] ?? 0) + 1;
      e.stores++;
      if (s.influenced) e.influenced++;
      const seg = segmentShort(s.segment);
      e.segments[seg] = (e.segments[seg] ?? 0) + 1;
    }
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

const EMPTY: OffTradeSummary = { key: "All", label: "All", stores: 0, influenced: 0, segments: {}, withProjects: 0, lastDate: null, targeted: 0, expected: 0, actual: 0, expectedDone: 0, assets: {}, bars: 0, barsInfluenced: 0 };
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

// ---------------------------------------------------------------------------
// Target-year KPIs
// ---------------------------------------------------------------------------

export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;
export type Quarter = (typeof QUARTERS)[number];
const quarterOf = (d: string | null | undefined, year: number): Quarter | null => {
  if (!d || Number(d.slice(0, 4)) !== year) return null;
  return QUARTERS[Math.floor((Number(d.slice(5, 7)) - 1) / 3)] ?? null;
};

export type TargetRow = {
  store: StoreView;
  /** A target-year project is completed. */
  achieved: boolean;
  /** When it's planned (earliest planned date of its target-year projects). */
  due: string | null;
  dueQ: Quarter | null;
  /** When it was achieved (latest completion). */
  doneDate: string | null;
  doneQ: Quarter | null;
  /** No project chosen yet, only flagged as a target. */
  tbc: boolean;
  types: string[];
  /** Projects for the year, and how many of them are done. */
  items: number;
  itemsDone: number;
  expected: number;
  actual: number;
};

/**
 * Every target store with its progress. A target is achieved once one of its target-year projects is
 * completed. It falls due in the quarter of its earliest planned date.
 */
export function targetRows(stores: StoreView[], year: number = TARGET_YEAR): TargetRow[] {
  const of = (s: StoreView) => (year === TARGET_YEAR ? s.targets : s.projects.filter((p) => p.status !== "cancelled" && yearOf(p) === year));
  return stores
    .filter((s) => (year === TARGET_YEAR ? s.targeted : s.target_year === year || of(s).length > 0))
    .map((s) => {
      const projects = of(s);
      const done = projects.filter((p) => p.status === "completed");
      const doneDate = done.map((p) => p.completed_date).filter((d): d is string => !!d).sort().at(-1) ?? null;
      const due = projects.map((p) => p.planned_date).filter((d): d is string => !!d).sort()[0] ?? null;
      return {
        store: s,
        achieved: done.length > 0,
        due,
        dueQ: quarterOf(due, year),
        doneDate,
        doneQ: quarterOf(doneDate, year),
        tbc: projects.length === 0,
        types: [...new Set(projects.map((p) => p.type))],
        items: projects.length,
        itemsDone: done.length,
        expected: projects.reduce((n, p) => n + Number(p.expected_cost_aed ?? 0), 0),
        actual: done.reduce((n, p) => n + Number(p.actual_cost_aed ?? 0), 0),
      };
    })
    .sort((a, b) => Number(a.achieved) - Number(b.achieved) || String(a.due ?? "9999").localeCompare(String(b.due ?? "9999")) || a.store.name.localeCompare(b.store.name));
}

export type TargetSummary = { key: string; label: string; targets: number; achieved: number; tbc: number; expected: number; actual: number };

export function targetsBy(rows: TargetRow[], keyOf: (r: TargetRow) => string | null, labelOf: (k: string) => string = (k) => k) {
  const map = new Map<string, TargetSummary>();
  for (const r of rows) {
    const key = keyOf(r) || "—";
    const e = map.get(key) ?? { key, label: key === "—" ? "—" : labelOf(key), targets: 0, achieved: 0, tbc: 0, expected: 0, actual: 0 };
    e.targets++;
    if (r.achieved) e.achieved++;
    if (r.tbc) e.tbc++;
    e.expected += r.expected;
    e.actual += r.actual;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.targets - a.targets);
}

/** By quarter: targets due in it, achieved in it, and how many of those due are achieved. */
export function targetsByQuarter(rows: TargetRow[]) {
  const q = [...QUARTERS, null].map((quarter) => {
    const due = rows.filter((r) => r.dueQ === quarter);
    return {
      quarter: quarter ?? "No date yet",
      due: due.length,
      dueAchieved: due.filter((r) => r.achieved).length,
      achievedIn: quarter ? rows.filter((r) => r.doneQ === quarter).length : rows.filter((r) => r.achieved && !r.doneQ).length,
    };
  });
  let running = 0;
  return q.map((x) => ({ ...x, cumulative: (running += x.achievedIn) }));
}

// ---------------------------------------------------------------------------
// History: projects done
// ---------------------------------------------------------------------------

export type HistoryRow = { store: StoreView; project: OffTradeProject; year: number | null; qty: number };

/** Completed projects (optionally one year), newest first. */
export function historyRows(stores: StoreView[], year?: number | null): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const s of stores) {
    for (const p of s.projects) {
      if (p.status !== "completed") continue;
      const y = p.completed_date ? Number(p.completed_date.slice(0, 4)) : yearOf(p);
      if (year && y !== year) continue;
      rows.push({ store: s, project: p, year: y, qty: Math.max(1, Number(p.quantity) || 1) });
    }
  }
  return rows.sort((a, b) => String(b.project.completed_date ?? "").localeCompare(String(a.project.completed_date ?? "")));
}

/** The years that have completed projects, newest first. */
export const historyYears = (stores: StoreView[]) =>
  [...new Set(historyRows(stores).map((r) => r.year).filter((y): y is number => !!y))].sort((a, b) => b - a);

export type YearActivation = {
  year: number;
  outlets: number;
  activated: number;
  pct: number;
  bars: number;
  /** Outlets not activated yet with work planned or locked in for the year. */
  planned: number;
};

/**
 * Per year: the outlets in the store list (bars aren't outlets) and how many were activated, i.e.
 * had something installed (a completed project) that year. Bars with work are counted on the side.
 */
export function activationByYear(stores: StoreView[], years: number[]): YearActivation[] {
  return [...years]
    .sort((a, b) => a - b)
    .map((year) => {
      const outlets = stores.filter((s) => !s.bar && (!s.opened_year || s.opened_year <= year));
      const rows = historyRows(stores, year);
      const ids = new Set(rows.filter((r) => !r.store.bar).map((r) => r.store.id));
      const bars = new Set(rows.filter((r) => r.store.bar).map((r) => r.store.id)).size;
      const planned = outlets.filter((s) => !ids.has(s.id) && s.projects.some((p) => (p.status === "planned" || p.status === "in_progress") && yearOf(p) === year)).length;
      return { year, outlets: outlets.length, activated: ids.size, pct: outlets.length ? (ids.size / outlets.length) * 100 : 0, bars, planned };
    });
}

export type HistorySummary = { key: string; label: string; projects: number; stores: number; items: number; cost: number; byYear: Record<number, { items: number; stores: number }> };

export function historyBy(rows: HistoryRow[], keyOf: (r: HistoryRow) => string | null, labelOf: (k: string) => string = (k) => k) {
  const map = new Map<string, HistorySummary & { storeIds: Set<string>; yearStores: Map<number, Set<string>> }>();
  for (const r of rows) {
    const key = keyOf(r) || "—";
    const e = map.get(key) ?? {
      key,
      label: key === "—" ? "—" : labelOf(key),
      projects: 0,
      stores: 0,
      items: 0,
      cost: 0,
      byYear: {} as Record<number, { items: number; stores: number }>,
      storeIds: new Set<string>(),
      yearStores: new Map<number, Set<string>>(),
    };
    e.projects++;
    e.items += r.qty;
    e.cost += Number(r.project.actual_cost_aed ?? 0);
    e.storeIds.add(r.store.id);
    if (r.year) {
      const y = (e.byYear[r.year] ??= { items: 0, stores: 0 });
      y.items += r.qty;
      const set = e.yearStores.get(r.year) ?? new Set<string>();
      set.add(r.store.id);
      e.yearStores.set(r.year, set);
      y.stores = set.size;
    }
    map.set(key, e);
  }
  return [...map.values()]
    .map(({ storeIds, yearStores: _y, ...e }) => ({ ...e, stores: storeIds.size }))
    .sort((a, b) => b.items - a.items);
}

/** Years the Targets page offers: the target year and the one before it (the year in progress). */
export const TARGET_YEARS = [TARGET_YEAR - 1, TARGET_YEAR];
export const readTargetYear = (v: string | string[] | undefined) => {
  const y = Number(Array.isArray(v) ? v[0] : v);
  return TARGET_YEARS.includes(y) ? y : TARGET_YEAR;
};

export const readHistoryYear = (v: string | string[] | undefined) => {
  const y = Number(Array.isArray(v) ? v[0] : v);
  return y > 2000 && y < 2100 ? y : null;
};
