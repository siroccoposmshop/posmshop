import { createAdminClient } from "@/lib/supabase/admin";
import { missingSalesforceSettings } from "@/lib/salesforce";
import { formatDate } from "@/lib/format";
import type { SyncSummary } from "@/lib/salesforce-sync";
import { SyncButton } from "./SyncButton";

/** Connection status, last sync result and "Sync now" for the Salesforce outlet list. */
export async function SalesforcePanel() {
  const missing = missingSalesforceSettings();
  const { data: last } = await createAdminClient()
    .from("sync_runs")
    .select("ok, summary, started_at, finished_at")
    .eq("source", "salesforce")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const s = (last?.summary ?? {}) as Partial<SyncSummary>;
  const unmapped = Object.entries(s.skipped?.unmappedCodes ?? {});

  return (
    <section className="bento mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1 text-sm">
        <h2 className="text-lg text-brand-black">Salesforce</h2>
        {missing.length ? (
          <p>
            Not connected yet. Outlets come from the Excel upload until these settings are added to the hosting
            environment: <code>{missing.join(", ")}</code>.
          </p>
        ) : !last ? (
          <p>Connected. No sync has run yet. It runs every night, or press Sync now.</p>
        ) : (
          <>
            <p>
              Last sync {formatDate(last.started_at, true)}:{" "}
              {last.ok ? (
                <span className="font-medium text-brand-green">
                  ✓ {(s.created ?? 0) + (s.updated ?? 0)} outlets ({s.created ?? 0} new), {s.deactivated ?? 0} closed
                  {s.tempClosed ? `, ${s.tempClosed} temporarily closed` : ""}
                </span>
              ) : (
                <span className="font-medium text-brand-red">failed: {s.error}</span>
              )}
            </p>
            {unmapped.length > 0 && (
              <p className="text-xs">
                Skipped company codes not linked to a market:{" "}
                {unmapped.map(([code, n]) => `${code} (${n})`).join(", ")}. Add them under Markets if they should be included.
              </p>
            )}
            {(s.skipped?.noNumber ?? 0) > 0 && <p className="text-xs">{s.skipped!.noNumber} open accounts had no account number and were skipped.</p>}
            {(s.skipped?.duplicate?.length ?? 0) > 0 && (
              <p className="text-xs">
                Duplicate account numbers (first one kept): {s.skipped!.duplicate.slice(0, 10).join(", ")}
                {s.skipped!.duplicate.length > 10 ? "…" : ""}
              </p>
            )}
          </>
        )}
      </div>
      <SyncButton disabled={missing.length > 0} />
    </section>
  );
}
