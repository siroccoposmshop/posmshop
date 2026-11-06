// Commerce Hub — roles, statuses and settings shared by the server and the browser.

export type HubRole = "kam" | "sm" | "cm" | "tm" | "tmm";

export const HUB_ROLES: { code: HubRole; label: string; short: string }[] = [
  { code: "kam", label: "Key Account Manager", short: "KAM" },
  { code: "sm", label: "Sales Manager", short: "SM" },
  { code: "cm", label: "Channel Manager", short: "CM" },
  { code: "tm", label: "Trade Marketing", short: "TM" },
  { code: "tmm", label: "Trade Marketing Manager", short: "TMM" },
];
export const hubRoleShort = (r: string | null | undefined) => HUB_ROLES.find((x) => x.code === r)?.short ?? "KAM";

/** The markets someone works in (several, or the single older market field). */
export const profileMarkets = (p: { markets?: string[] | null; market?: string | null }) => (p.markets?.length ? p.markets : p.market ? [p.market] : []);

/** Admin across the whole Hub: POSM admins plus TM and TMM. */
export const isAdminProfile = (p: { role?: string | null; hub_role?: string | null } | null | undefined) =>
  !!p && (p.role === "admin" || p.hub_role === "tm" || p.hub_role === "tmm");

/** Project reports: SMs (their team), CM, TM, TMM and admins (everything). */
export const canSeeProjectReports = (p: { role?: string | null; hub_role?: string | null } | null | undefined) =>
  isAdminProfile(p) || ["sm", "cm", "tm", "tmm"].includes(p?.hub_role ?? "");

/** Trade Marketing and the Channel Manager run projects: vetting, stages and admin actions. */
export const PROJECT_ADMINS: HubRole[] = ["tm", "tmm", "cm"];
/** Roles that see every project. */
export const SEES_ALL: HubRole[] = ["tm", "tmm", "cm"];
/**
 * Projects settings, editable in Admin → Projects (table hub_settings). These are the defaults
 * used until that's set up.
 *  - smApprovalAed: budget (AED) from which the Sales Manager must approve
 *  - cmApprovalAed: budget from which CM/TMM must approve too
 *  - gpPerHlUsd: estimated gross profit per incremental hectolitre (USD)
 */
export type HubSettings = { smApprovalAed: number; cmApprovalAed: number; gpPerHlUsd: number };
export const DEFAULT_HUB_SETTINGS: HubSettings = { smApprovalAed: 15000, cmApprovalAed: 50000, gpPerHlUsd: 200 };

/** USD → AED (the dirham peg; the same rate POSM Shop prices use). */
export const USD_TO_AED = 3.6725;
export const gpPerHlAed = (s: HubSettings) => s.gpPerHlUsd * USD_TO_AED;
/** Spend as a share of the uplift's GP: from 75% it looks GP neutral, from 90% GP negative. */
export const GP_NEUTRAL_FROM = 0.75;
export const GP_NEGATIVE_FROM = 0.9;

/** Who approves a request of this size: SM (unless an SM raised it), then CM/TMM from the higher threshold. */
export function approvalStatus(budget: number, submitterIsSm: boolean, s: HubSettings): "awaiting_sm" | "awaiting_cm" | "awaiting_tm" {
  if (budget >= s.smApprovalAed && !submitterIsSm) return "awaiting_sm";
  return budget >= s.cmApprovalAed ? "awaiting_cm" : "awaiting_tm";
}

export type ExtraSource = "sirocco" | "other";
export const EXTRA_SOURCE_LABEL: Record<ExtraSource, string> = { sirocco: "Sirocco", other: "Other" };

/** The budget split. Projects from before the split count the whole budget as BIF. */
export function budgetSplit(p: { budget_aed: number; budget_bif?: number | null; budget_extra?: number | null; budget_extra_source?: string | null }) {
  const extra = Number(p.budget_extra) || 0;
  const source = extra > 0 && (p.budget_extra_source === "sirocco" || p.budget_extra_source === "other") ? (p.budget_extra_source as ExtraSource) : null;
  const bif = p.budget_bif != null ? Number(p.budget_bif) : Number(p.budget_aed) - extra;
  return { bif, extra: source ? extra : 0, source, total: Number(p.budget_aed), sirocco: source === "sirocco" ? extra : 0 };
}

/** Spend against the estimated GP from the volume uplift. */
export function gpCheck(spend: number, incrementalHl: number | null | undefined, s: HubSettings) {
  if (incrementalHl === null || incrementalHl === undefined || !(spend > 0)) return null;
  const gp = Math.max(0, incrementalHl) * gpPerHlAed(s);
  const ratio = gp > 0 ? spend / gp : Infinity;
  const level = ratio >= GP_NEGATIVE_FROM ? "negative" : ratio >= GP_NEUTRAL_FROM ? "neutral" : "ok";
  return { gp, ratio, level } as const;
}

export function gpWarningText(check: NonNullable<ReturnType<typeof gpCheck>>, s: HubSettings) {
  const pct = Number.isFinite(check.ratio) ? `${Math.floor(check.ratio * 100)}% of` : "more than";
  return `The spend is ${pct} the estimated ${formatAed(check.gp)} GP from the volume uplift (USD ${s.gpPerHlUsd} per HL at ${USD_TO_AED}).`;
}

export const PROJECT_TYPES = ["Bar", "Activation", "Furniture", "Cladding", "Fridges", "Brunch station"] as const;

export type ProjectStatus = "awaiting_sm" | "awaiting_cm" | "awaiting_tm" | "rejected" | "live" | "paused" | "completed" | "cancelled";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  awaiting_sm: "Awaiting SM approval",
  awaiting_cm: "Awaiting CM/TMM approval",
  awaiting_tm: "With Trade Marketing",
  rejected: "Sent back",
  live: "Live",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const isRequest = (s: ProjectStatus) => s === "awaiting_sm" || s === "awaiting_cm" || s === "awaiting_tm";
export const isPast = (s: ProjectStatus) => s === "completed" || s === "cancelled" || s === "rejected";

/** Minimum length for the written brief. */
export const MIN_BRIEF_CHARS = 80;

export const formatAed = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `AED ${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
