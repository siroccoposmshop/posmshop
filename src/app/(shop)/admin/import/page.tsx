import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { ImportForm, BulkImagesForm } from "./ImportForms";

export const metadata = { title: "Excel upload" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const db = createAdminClient();
  const { data: imports } = await db
    .from("imports")
    .select("id, filename, summary, created_at, profiles(email)")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="accent-square text-3xl text-brand-black">Excel upload</h1>
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
