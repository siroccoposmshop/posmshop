import "server-only";
import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyName, outletName } from "@/lib/format";
import { SEES_ALL, STATUS_LABEL, budgetSplit, isAdminProfile, type ProjectStatus } from "@/lib/hub";
import { otherOutletsWithTicks, picosLines, picosScores, promisedItems, type Picos, type PicosLine } from "@/lib/picos";
import { hubRole, personName, type Person, type Project } from "@/lib/projects";
import type { Profile } from "@/lib/types";

// ---------------------------------------------------------------------------
// Who can see what
// ---------------------------------------------------------------------------

/** null = every project; a list = these KAMs' projects (an SM's team); false = no access (KAMs). */
export async function projectReportScope(profile: Profile): Promise<string[] | null | false> {
  const role = hubRole(profile);
  if (isAdminProfile(profile) || SEES_ALL.includes(role)) return null;
  if (role !== "sm") return false;
  const { data } = await createAdminClient().from("profiles").select("id").eq("manager_id", profile.id);
  return [profile.id, ...(data ?? []).map((r) => r.id as string)];
}

// ---------------------------------------------------------------------------
// Filters (from the URL; repeated keys for multi-select)
// ---------------------------------------------------------------------------

export const STATUS_GROUPS = {
  requests: { label: "Requests", statuses: ["awaiting_sm", "awaiting_cm", "awaiting_tm"] },
  live: { label: "Live / paused", statuses: ["live", "paused"] },
  completed: { label: "Completed", statuses: ["completed"] },
  sent_back: { label: "Sent back", statuses: ["rejected"] },
  cancelled: { label: "Cancelled", statuses: ["cancelled"] },
} as const;
export type StatusGroup = keyof typeof STATUS_GROUPS;

export type ProjectReportFilters = {
  from?: string;
  to?: string;
  market?: string;
  kam: string[];
  customer: string[];
  status: StatusGroup[];
  type: string[];
  brand: string[];
};

export function readProjectFilters(sp: Record<string, string | string[] | undefined>): ProjectReportFilters {
  const list = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v : v ? [v] : []).map((x) => x.trim()).filter(Boolean);
  };
  const one = (k: string) => (typeof sp[k] === "string" && /\S/.test(sp[k] as string) ? (sp[k] as string).trim() : undefined);
  return {
    from: one("from"),
    to: one("to"),
    market: one("market"),
    kam: list("kam"),
    customer: list("customer"),
    status: list("status").filter((s): s is StatusGroup => s in STATUS_GROUPS),
    type: list("type"),
    brand: list("brand"),
  };
}

export function filtersToQuery(f: ProjectReportFilters) {
  const q = new URLSearchParams();
  for (const k of ["from", "to", "market"] as const) if (f[k]) q.set(k, f[k]!);
  for (const k of ["kam", "customer", "status", "type", "brand"] as const) for (const v of f[k]) q.append(k, v);
  return q.toString();
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const APPROVED = ["live", "paused", "completed"];
const WAITING = ["awaiting_sm", "awaiting_cm", "awaiting_tm"];

/** PICOS changes negotiated and delivered, at the outlet and the other outlets in the deal. */
function picosCounts(p: { outlet_type: string; picos: Picos }) {
  const main = promisedItems(p.outlet_type, p.picos);
  let negotiated = main.length;
  let delivered = main.filter((i) => p.picos.items[i.key]?.delivered_at).length;
  for (const [, o] of otherOutletsWithTicks(p.picos)) {
    const items = promisedItems(o.outlet_type, { items: o.items, notes: {} });
    negotiated += items.length;
    delivered += items.filter((i) => o.items[i.key]?.delivered_at).length;
  }
  return { negotiated, delivered, otherOutlets: otherOutletsWithTicks(p.picos).length };
}

export type ProjectReportRow = {
  id: string;
  ref: string;
  title: string;
  status: ProjectStatus;
  statusLabel: string;
  submitted: string;
  completed: string | null;
  /** Planned completion (end of the last stage), once the project is running. */
  target: string | null;
  kamId: string;
  kam: string;
  customerKey: string;
  customer: string;
  outletId: string | null;
  outlet: string;
  accountNumber: string;
  market: string | null;
  type: string;
  brands: string[];
  budget: number;
  /** Entered on completion; null until then. */
  finalCost: number | null;
  /** What counts as spend: the final cost once known, else the budget. */
  spend: number;
  bif: number;
  sirocco: number;
  other: number;
  approved: boolean;
  waiting: boolean;
  picosNow: number;
  picosAfter: number;
  negotiated: number;
  delivered: number;
  otherOutlets: number;
  /** Each negotiated PICOS change, with its outlet and whether it's delivered. */
  lines: PicosLine[];
};

export async function getProjectReportRows(f: ProjectReportFilters, scope: string[] | null): Promise<{ rows: ProjectReportRow[]; all: ProjectReportRow[] }> {
  const db = createAdminClient();
  let q = db.from("projects").select("*").eq("hidden_for_kam", false).order("submitted_at", { ascending: false }).limit(5000);
  if (scope) q = q.in("kam_id", scope);
  const [{ data, error }, { data: people }] = await Promise.all([q, db.from("profiles").select("id, email, full_name, hub_role, manager_id")]);
  if (error) throw new Error(error.message);
  const byId = new Map(((people as Person[]) ?? []).map((p) => [p.id, p]));

  const all: ProjectReportRow[] = ((data as Project[]) ?? []).map((p) => {
    const b = budgetSplit(p);
    const sc = picosScores(p.outlet_type, p.picos);
    const pc = picosCounts(p);
    return {
      id: p.id,
      ref: p.ref,
      title: p.name || `${p.project_type} · ${outletName(p.account_name)}`,
      status: p.status,
      statusLabel: STATUS_LABEL[p.status],
      submitted: p.submitted_at,
      completed: p.completed_at,
      target: p.target_date,
      kamId: p.kam_id,
      kam: personName(byId.get(p.kam_id)),
      customerKey: p.parent_number || p.account_number,
      customer: companyName(p.parent_name || p.account_name),
      outletId: p.account_id,
      outlet: outletName(p.account_name),
      accountNumber: p.account_number,
      market: p.market,
      type: p.project_type,
      brands: p.brands ?? [],
      budget: b.total,
      finalCost: p.final_cost_aed != null ? Number(p.final_cost_aed) : null,
      spend: p.final_cost_aed != null ? Number(p.final_cost_aed) : b.total,
      bif: b.bif,
      sirocco: b.sirocco,
      other: b.source === "other" ? b.extra : 0,
      approved: APPROVED.includes(p.status),
      waiting: WAITING.includes(p.status),
      picosNow: sc.current,
      picosAfter: sc.promised,
      negotiated: pc.negotiated,
      delivered: pc.delivered,
      otherOutlets: pc.otherOutlets,
      lines: picosLines(p).map((l) => ({ ...l, outlet: outletName(l.outlet) })),
    };
  });

  const statuses = new Set(f.status.flatMap((g) => STATUS_GROUPS[g].statuses as readonly string[]));
  const rows = all.filter(
    (r) =>
      (!f.from || r.submitted.slice(0, 10) >= f.from) &&
      (!f.to || r.submitted.slice(0, 10) <= f.to) &&
      (!f.market || r.market === f.market) &&
      (!f.kam.length || f.kam.includes(r.kamId)) &&
      (!f.customer.length || f.customer.includes(r.customerKey)) &&
      (!statuses.size || statuses.has(r.status)) &&
      (!f.type.length || f.type.includes(r.type)) &&
      (!f.brand.length || r.brands.some((b) => f.brand.includes(b))),
  );
  return { rows, all };
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export type Summary = {
  key: string;
  label: string;
  sub?: string;
  projects: number;
  approvedSpend: number;
  waitingSpend: number;
  sirocco: number;
  negotiated: number;
  delivered: number;
  upliftTotal: number;
  upliftCount: number;
  outlets: Set<string>;
};

function summarise(rows: ProjectReportRow[], keyOf: (r: ProjectReportRow) => string, labelOf: (r: ProjectReportRow) => { label: string; sub?: string }) {
  const map = new Map<string, Summary>();
  for (const r of rows) {
    const key = keyOf(r);
    const s = map.get(key) ?? { key, ...labelOf(r), projects: 0, approvedSpend: 0, waitingSpend: 0, sirocco: 0, negotiated: 0, delivered: 0, upliftTotal: 0, upliftCount: 0, outlets: new Set<string>() };
    s.projects++;
    if (r.approved) {
      s.approvedSpend += r.spend;
      s.sirocco += r.sirocco;
    }
    if (r.waiting) s.waitingSpend += r.budget;
    if (r.status !== "rejected" && r.status !== "cancelled") {
      s.negotiated += r.negotiated;
      s.delivered += r.delivered;
      s.upliftTotal += r.picosAfter - r.picosNow;
      s.upliftCount++;
    }
    s.outlets.add(r.outletId ?? r.accountNumber);
    map.set(key, s);
  }
  return [...map.values()].sort((a, b) => b.approvedSpend - a.approvedSpend || b.waitingSpend - a.waitingSpend || b.projects - a.projects);
}

export const byKam = (rows: ProjectReportRow[]) => summarise(rows, (r) => r.kamId, (r) => ({ label: r.kam }));
export const byCustomer = (rows: ProjectReportRow[]) => summarise(rows, (r) => r.customerKey, (r) => ({ label: r.customer, sub: `#${r.customerKey}` }));
export const byOutlet = (rows: ProjectReportRow[]) =>
  summarise(rows, (r) => r.outletId ?? r.accountNumber, (r) => ({ label: r.outlet, sub: r.customer.toLowerCase() !== r.outlet.toLowerCase() ? r.customer : `#${r.accountNumber}` }));

export function totals(rows: ProjectReportRow[]) {
  const [t] = summarise(rows, () => "all", () => ({ label: "All" }));
  return {
    projects: rows.length,
    approvedSpend: t?.approvedSpend ?? 0,
    waitingSpend: t?.waitingSpend ?? 0,
    sirocco: t?.sirocco ?? 0,
    negotiated: t?.negotiated ?? 0,
    delivered: t?.delivered ?? 0,
    avgUplift: t?.upliftCount ? Math.round(t.upliftTotal / t.upliftCount) : 0,
    live: rows.filter((r) => r.status === "live" || r.status === "paused").length,
    completed: rows.filter((r) => r.status === "completed").length,
    waiting: rows.filter((r) => r.waiting).length,
  };
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

const COLUMNS: { header: string; width: number; value: (r: ProjectReportRow) => string | number }[] = [
  { header: "Ref", width: 11, value: (r) => r.ref },
  { header: "Project", width: 32, value: (r) => r.title },
  { header: "Status", width: 22, value: (r) => r.statusLabel },
  { header: "Submitted", width: 12, value: (r) => r.submitted.slice(0, 10) },
  { header: "Completed", width: 12, value: (r) => r.completed?.slice(0, 10) ?? "" },
  { header: "Project lead", width: 20, value: (r) => r.kam },
  { header: "Customer", width: 28, value: (r) => r.customer },
  { header: "Customer #", width: 12, value: (r) => r.customerKey },
  { header: "Outlet", width: 28, value: (r) => r.outlet },
  { header: "Outlet #", width: 12, value: (r) => r.accountNumber },
  { header: "Market", width: 8, value: (r) => r.market ?? "" },
  { header: "Type", width: 14, value: (r) => r.type },
  { header: "Brands", width: 24, value: (r) => r.brands.join(", ") },
  { header: "Budget (AED)", width: 14, value: (r) => r.budget },
  { header: "Final cost (AED)", width: 14, value: (r) => r.finalCost ?? "" },
  { header: "Spend (AED)", width: 13, value: (r) => (r.approved ? r.spend : 0) },
  { header: "BIF (AED)", width: 12, value: (r) => r.bif },
  { header: "Sirocco (AED)", width: 13, value: (r) => r.sirocco },
  { header: "Other funding (AED)", width: 14, value: (r) => r.other },
  { header: "PICOS now %", width: 11, value: (r) => r.picosNow },
  { header: "PICOS after %", width: 12, value: (r) => r.picosAfter },
  { header: "PICOS negotiated", width: 14, value: (r) => r.negotiated },
  { header: "PICOS delivered", width: 14, value: (r) => r.delivered },
  { header: "Other outlets", width: 11, value: (r) => r.otherOutlets },
];

export function projectsToCsv(rows: ProjectReportRow[]) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [COLUMNS.map((c) => c.header).join(","), ...rows.map((r) => COLUMNS.map((c) => esc(c.value(r))).join(","))].join("\r\n");
}

export async function projectsToXlsx(rows: ProjectReportRow[]) {
  const wb = new ExcelJS.Workbook();
  const list = wb.addWorksheet("Projects");
  list.columns = COLUMNS.map((c, i) => ({ header: c.header, key: String(i), width: c.width }));
  for (const r of rows) list.addRow(Object.fromEntries(COLUMNS.map((c, i) => [String(i), c.value(r)])));

  const sheet = (name: string, first: string, data: Summary[]) => {
    const ws = wb.addWorksheet(name);
    ws.columns = [
      { header: first, key: "label", width: 30 },
      { header: "Projects", key: "projects", width: 10 },
      { header: "Outlets", key: "outlets", width: 10 },
      { header: "Spend (AED)", key: "approvedSpend", width: 16 },
      { header: "Waiting approval (AED)", key: "waitingSpend", width: 18 },
      { header: "Sirocco (AED)", key: "sirocco", width: 14 },
      { header: "PICOS negotiated", key: "negotiated", width: 14 },
      { header: "PICOS delivered", key: "delivered", width: 14 },
    ];
    for (const s of data) ws.addRow({ ...s, outlets: s.outlets.size });
    return ws;
  };
  const picos = wb.addWorksheet("PICOS");
  picos.columns = [
    { header: "PICOS item", key: "label", width: 34 },
    { header: "Group", key: "group", width: 14 },
    { header: "Points", key: "points", width: 8 },
    { header: "Outlet", key: "outlet", width: 26 },
    { header: "Customer", key: "customer", width: 26 },
    { header: "Ref", key: "ref", width: 11 },
    { header: "Project", key: "title", width: 30 },
    { header: "Project lead", key: "kam", width: 20 },
    { header: "Project status", key: "statusLabel", width: 22 },
    { header: "Completed", key: "completed", width: 12 },
    { header: "Due", key: "target", width: 12 },
    { header: "PICOS status", key: "picosStatus", width: 26 },
    { header: "Delivered", key: "deliveredAt", width: 12 },
  ];
  for (const l of picosReportLines(rows)) {
    picos.addRow({
      ...l,
      completed: l.completed?.slice(0, 10) ?? "",
      target: l.target ?? "",
      deliveredAt: l.deliveredAt?.slice(0, 10) ?? "",
      picosStatus: l.deliveredAt ? "Delivered" : l.overdue ? "Pending - project complete" : "Pending",
    });
  }
  const sheets = [list, sheet("By project lead", "Project lead", byKam(rows)), sheet("By customer", "Customer", byCustomer(rows)), sheet("By outlet", "Outlet", byOutlet(rows)), picos];
  for (const ws of sheets) {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF58A244" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  return wb.xlsx.writeBuffer();
}

// ---------------------------------------------------------------------------
// PICOS, item by item
// ---------------------------------------------------------------------------

export type PicosShow = "pending" | "delivered" | "all";
export const readPicosShow = (v: string | string[] | undefined): PicosShow => (v === "delivered" || v === "all" ? v : "pending");

export type PicosReportLine = PicosLine & {
  projectId: string;
  ref: string;
  title: string;
  kam: string;
  customer: string;
  status: ProjectStatus;
  statusLabel: string;
  completed: string | null;
  target: string | null;
  /** The project is complete but this change isn't delivered: an action for the project lead and their SM. */
  overdue: boolean;
};

/** PICOS lines of projects that count (not cancelled or sent back): overdue first, then pending by date, then delivered. */
export function picosReportLines(rows: ProjectReportRow[]): PicosReportLine[] {
  const out: PicosReportLine[] = [];
  for (const r of rows) {
    if (r.status === "cancelled" || r.status === "rejected") continue;
    for (const l of r.lines) {
      out.push({ ...l, projectId: r.id, ref: r.ref, title: r.title, kam: r.kam, customer: r.customer, status: r.status, statusLabel: r.statusLabel, completed: r.completed, target: r.target, overdue: r.status === "completed" && !l.deliveredAt });
    }
  }
  const rank = (l: PicosReportLine) => (l.overdue ? 0 : !l.deliveredAt ? 1 : 2);
  const when = (l: PicosReportLine) => (l.deliveredAt ?? l.completed ?? l.target ?? "9999");
  return out.sort((a, b) => rank(a) - rank(b) || when(a).localeCompare(when(b)) || a.ref.localeCompare(b.ref));
}

/** By PICOS criterion: how often it's negotiated, delivered, pending, and pending on completed projects. */
export function byPicosItem(lines: PicosReportLine[]) {
  const map = new Map<string, { key: string; label: string; group: string; negotiated: number; delivered: number; pending: number; overdue: number }>();
  for (const l of lines) {
    const e = map.get(l.key) ?? { key: l.key, label: l.label, group: l.group, negotiated: 0, delivered: 0, pending: 0, overdue: 0 };
    e.negotiated++;
    if (l.deliveredAt) e.delivered++;
    else e.pending++;
    if (l.overdue) e.overdue++;
    map.set(l.key, e);
  }
  return [...map.values()].sort((a, b) => b.overdue - a.overdue || b.pending - a.pending || b.negotiated - a.negotiated);
}
