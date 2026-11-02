import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalesforceAccounts, planAccountRows, salesforceConfig, type ResolvedFields } from "@/lib/salesforce";

export type SyncSummary = {
  fetched: number;
  created: number;
  updated: number;
  deactivated: number;
  tempClosed: number;
  skipped: { notOpen: number; noNumber: number; duplicate: string[]; unmappedCodes: Record<string, number> };
  markets: string[];
  fields: Record<string, string>;
  error?: string;
};

// Safety stop: a sync that would leave far fewer open outlets than before is more likely a
// Salesforce or mapping problem than real closures, so nothing is changed.
const MIN_KEEP_RATIO = 0.5;

/**
 * Pulls open Accounts from Salesforce into POSM SHOP's outlet list.
 * Outlets in the synced markets that are no longer open in Salesforce are marked inactive
 * (never deleted, so order history stays intact). Markets without company codes are left alone.
 */
export async function runSalesforceSync(opts: { triggeredBy?: string | null } = {}) {
  const db = createAdminClient();
  const { data: run } = await db
    .from("sync_runs")
    .insert({ source: "salesforce", triggered_by: opts.triggeredBy ?? null })
    .select("id")
    .single();

  const finish = async (ok: boolean, summary: Partial<SyncSummary>) => {
    if (run) await db.from("sync_runs").update({ ok, summary, finished_at: new Date().toISOString() }).eq("id", run.id);
    return { ok, summary };
  };

  try {
    const cfg = salesforceConfig();
    if (!cfg) return finish(false, { error: "Salesforce isn't connected yet (settings missing)." });

    const { data: markets, error: mErr } = await db.from("markets").select("code, salesforce_company_codes");
    if (mErr) throw new Error(mErr.message);
    const companyMarkets = new Map<string, string>();
    for (const m of markets ?? []) for (const c of (m.salesforce_company_codes as string[]) ?? []) companyMarkets.set(c.trim().toUpperCase(), m.code);
    const syncedMarkets = [...new Set(companyMarkets.values())];
    if (!syncedMarkets.length) return finish(false, { error: "No Salesforce company codes are set. Add them under Admin → Markets." });

    const { records, fields } = await fetchSalesforceAccounts(cfg);
    const { rows, skipped } = planAccountRows(records, fields, companyMarkets);
    const base: Partial<SyncSummary> = { fetched: records.length, skipped, markets: syncedMarkets, fields: fieldNames(fields) };

    const { data: current, error: cErr } = await db.from("accounts").select("account_number, active, market").in("market", syncedMarkets);
    if (cErr) throw new Error(cErr.message);
    const existing = new Set((current ?? []).map((a) => a.account_number as string));
    const openBefore = (current ?? []).filter((a) => a.active).length;
    const keep = new Set(rows.map((r) => r.account_number));

    if (!rows.length) return finish(false, { ...base, error: "Salesforce returned no open outlets for the mapped company codes. Nothing was changed." });
    if (openBefore > 20 && rows.length < openBefore * MIN_KEEP_RATIO) {
      return finish(false, {
        ...base,
        error: `Salesforce returned ${rows.length} open outlets, but POSM SHOP has ${openBefore}. That drop looks wrong, so nothing was changed. Check the company codes and the PICOS Tracking field.`,
      });
    }

    const now = new Date().toISOString();
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({ ...r, updated_at: now }));
      const { error } = await db.from("accounts").upsert(chunk, { onConflict: "account_number" });
      if (error) throw new Error(`Saving outlets failed: ${error.message}`);
    }

    const toClose = (current ?? []).filter((a) => a.active && !keep.has(a.account_number as string)).map((a) => a.account_number as string);
    for (let i = 0; i < toClose.length; i += 500) {
      const { error } = await db.from("accounts").update({ active: false, updated_at: now }).in("account_number", toClose.slice(i, i + 500));
      if (error) throw new Error(`Closing outlets failed: ${error.message}`);
    }

    return finish(true, {
      ...base,
      created: rows.filter((r) => !existing.has(r.account_number)).length,
      updated: rows.filter((r) => existing.has(r.account_number)).length,
      deactivated: toClose.length,
      tempClosed: rows.filter((r) => !r.active).length,
    });
  } catch (e) {
    console.error("Salesforce sync failed", e);
    return finish(false, { error: e instanceof Error ? e.message : "Salesforce sync failed." });
  }
}

function fieldNames(fields: ResolvedFields) {
  return Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f!.name]));
}
