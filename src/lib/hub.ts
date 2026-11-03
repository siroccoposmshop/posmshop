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

/** Trade Marketing and the Channel Manager run projects: vetting, stages and admin actions. */
export const PROJECT_ADMINS: HubRole[] = ["tm", "tmm", "cm"];
/** Roles that see every project. */
export const SEES_ALL: HubRole[] = ["tm", "tmm", "cm"];
/** Budget (AED) from which the Sales Manager must approve, and from which CM/TMM must approve too. */
export const SM_APPROVAL_AED = 15000;
export const CM_APPROVAL_AED = 50000;

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
