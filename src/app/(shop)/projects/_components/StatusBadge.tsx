import { STATUS_LABEL } from "@/lib/hub";
import type { ProjectView } from "./types";

/** On track / due soon / behind for live projects, otherwise the status. */
export function ProjectBadge({ p, large }: { p: Pick<ProjectView, "status" | "health"> & { hidden_for_kam?: boolean }; large?: boolean }) {
  if (p.hidden_for_kam) {
    return <span className={`badge whitespace-nowrap bg-white text-brand-red ring-1 ring-brand-red ${large ? "!px-3 !py-1 !text-sm" : ""}`}>Deleted by project lead</span>;
  }
  const h = p.health;
  const [cls, text] =
    p.status === "live"
      ? h.state === "behind"
        ? ["bg-brand-red text-white", h.daysLate ? `Behind · ${h.daysLate}d` : "Behind"]
        : h.state === "due_soon"
          ? ["bg-amber-500 text-white", "Stage due soon"]
          : ["bg-brand-green text-white", "On track"]
      : p.status === "completed"
        ? ["bg-brand-green-tint text-brand-green-dark", STATUS_LABEL.completed]
        : p.status === "rejected"
          ? ["bg-brand-red/10 text-brand-red", STATUS_LABEL.rejected]
          : p.status === "cancelled" || p.status === "paused"
            ? ["bg-brand-light text-brand-grey", STATUS_LABEL[p.status]]
            : ["bg-white text-brand-black ring-1 ring-black/15", STATUS_LABEL[p.status]];
  return <span className={`badge whitespace-nowrap ${large ? "!px-3 !py-1 !text-sm" : ""} ${cls}`}>{text}</span>;
}
