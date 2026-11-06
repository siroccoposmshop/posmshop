import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { ImportForm, BulkImagesForm, StockReportForm } from "./ImportForms";
import type { StockRunSummary } from "@/lib/stock-report";

export const metadata = { title: "Upload" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const db = createAdminClient();
  const { data: imports } = await db
    .from("imports")
    .select("id, filename, summary, created_at, profiles(email)")
    .order("created_at", { ascending: false })
    .limit(10);
  const { data: stockRuns } = await db
    .from("sync_runs")
    .select("id, source, ok, summary, started_at")
    .in("source", ["stock_email", "stock_upload"])
    .order("started_at", { ascending: false })
    .limit(10);
  const emailReady = !!process.env.RESEND_WEBHOOK_SECRET && !!process.env.STOCK_EMAIL_SENDERS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="accent-square text-3xl text-brand-black">Upload</h1>
        <p className="mt-2 max-w-3xl text-sm">
          Upload the latest <strong>2026 POSM Budgeting</strong> workbook. Items are matched on SKU code and
          accounts on account number. The upload <strong>overrides stock levels</strong> and updates names,
          brands, categories and values. Images, visibility, markets and ETA dates set here are kept.{" "}
          <a href="/admin/import/template" className="underline">
            Download the column template
          </a>
          .
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ImportForm />
        <BulkImagesForm />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StockReportForm />
        <section className="bento space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl text-brand-black">Stock feed</h2>
            <span className={`badge ${emailReady ? "bg-brand-green text-white" : "bg-brand-light text-brand-grey"}`}>
              {emailReady ? "Email feed on" : "Email feed not set up"}
            </span>
          </div>
          <p className="text-sm">
            When IT&apos;s stock report email arrives, stock updates automatically and admins get a summary. Each run is listed here.
          </p>
          {!stockRuns?.length ? (
            <p className="text-sm">No stock reports yet.</p>
          ) : (
            <ul className="divide-y divide-black/5 text-sm">
              {stockRuns.map((r) => {
                const s = r.summary as Partial<StockRunSummary>;
                return (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-brand-black">
                        {r.ok ? `✓ ${s.updated ?? 0} items updated` : "Not updated"}
                        <span className="text-xs text-brand-grey"> · {r.source === "stock_email" ? "email" : "upload"}</span>
                      </span>
                      <span className={`block truncate text-xs ${r.ok ? "" : "text-brand-red"}`}>{r.ok ? (s.file ?? "") : (s.reason ?? "")}</span>
                    </span>
                    <span className="shrink-0 text-xs">{formatDate(r.started_at, true)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="bento overflow-x-auto">
        <h2 className="mb-3 text-xl text-brand-black">Recent uploads</h2>
        {!imports?.length ? (
          <p className="text-sm">No uploads yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>File</th>
                <th>By</th>
                <th className="text-right">Items</th>
                <th className="text-right">Accounts</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((i) => {
                const s = i.summary as { items?: { total: number }; accounts?: { total: number } };
                const by = (i.profiles as unknown as { email: string } | null)?.email;
                return (
                  <tr key={i.id}>
                    <td className="whitespace-nowrap">{formatDate(i.created_at, true)}</td>
                    <td>{i.filename}</td>
                    <td>{by}</td>
                    <td className="text-right">{s.items?.total ?? 0}</td>
                    <td className="text-right">{s.accounts?.total ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
