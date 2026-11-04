import { formatDate } from "@/lib/format";
import { formatAed } from "@/lib/hub";
import type { Investment } from "@/lib/projects";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Earlier investment in the outlet and its customer. On the brief it speaks to the KAM ("You have
 * invested…"); on the project page it's neutral.
 */
export function InvestmentNote({ investment: inv, company, you }: { investment: Investment; company?: string; you?: boolean }) {
  // Nothing to flag when there's been no investment.
  if (!(inv.outlet.count > 0 || inv.group.count > 0 || inv.pending.count > 0)) return null;
  return (
    <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-brand-black" role="status">
      {inv.outlet.count > 0 && (
        <p>
          <strong>
            {you ? "You have invested" : "Previously invested:"} {formatAed(inv.outlet.total)}
          </strong>{" "}
          in this outlet{you ? " previously" : ""} ({plural(inv.outlet.count, "project")}
          {inv.outlet.latest ? `, latest ${inv.outlet.latest.ref} · ${formatDate(inv.outlet.latest.date)}` : ""}).
        </p>
      )}
      {inv.group.total > inv.outlet.total && (
        <p className="mt-0.5">
          {formatAed(inv.group.total)} across {company || "this customer"} ({plural(inv.group.count, "project")}).
        </p>
      )}
      {inv.pending.count > 0 && (
        <p className="mt-0.5">
          {formatAed(inv.pending.total)} more is waiting for approval here ({plural(inv.pending.count, "request")}).
        </p>
      )}
    </div>
  );
}
