import Link from "next/link";
import { formatDate } from "@/lib/format";
import { formatAed } from "@/lib/hub";
import { MARKETS } from "@/lib/markets";
import { STATUS_GROUPS, byCustomer, byKam, byOutlet, filtersToQuery, totals, type ProjectReportFilters, type ProjectReportRow, type Summary } from "@/lib/project-reports";
import { MultiSelect } from "@/components/MultiSelect";

/** The Project reports dashboard for a set of rows (all = everything in scope, for the filter lists). */
export function ReportsView({ rows, all, f, team }: { rows: ProjectReportRow[]; all: ProjectReportRow[]; f: ProjectReportFilters; team: boolean }) {
  const t = totals(rows);
  const kams = byKam(rows);
  const customers = byCustomer(rows);
  const outlets = byOutlet(rows);
  const qs = filtersToQuery(f);
  const filtered = qs.length > 0;

  const uniq = <T,>(list: T[], key: (x: T) => string) => [...new Map(list.map((x) => [key(x), x])).values()];
  const kamOptions = uniq(all, (r) => r.kamId).map((r) => ({ value: r.kamId, label: r.kam })).sort((a, b) => a.label.localeCompare(b.label));
  const customerOptions = uniq(all, (r) => r.customerKey)
    .map((r) => ({ value: r.customerKey, label: r.customer, sub: `#${r.customerKey}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const typeOptions = [...new Set(all.map((r) => r.type))].sort().map((v) => ({ value: v, label: v }));
  const brandOptions = [...new Set(all.flatMap((r) => r.brands))].sort().map((v) => ({ value: v, label: v }));
  const statusOptions = Object.entries(STATUS_GROUPS).map(([value, g]) => ({ value, label: g.label }));
  const maxKam = Math.max(1, ...kams.map((k) => k.approvedSpend));
  const maxCustomer = Math.max(1, ...customers.map((c) => c.approvedSpend));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="accent-square text-3xl text-brand-black">Project reports</h1>
          <p className="mt-1 text-sm">{team ? "Your team's projects" : "All projects"} · spend, PICOS and progress by KAM, customer and outlet.</p>
        </div>
        <div className="flex gap-2">
          <a href={`/projects/reports/export?format=xlsx${qs ? `&${qs}` : ""}`} className="btn btn-secondary">
            Excel
          </a>
          <a href={`/projects/reports/export?format=csv${qs ? `&${qs}` : ""}`} className="btn btn-secondary">
            CSV
          </a>
        </div>
      </div>

      <form className="bento grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MultiSelect name="kam" label="KAM" allLabel="All KAMs" options={kamOptions} selected={f.kam} />
        <MultiSelect name="customer" label="Customer" allLabel="All customers" options={customerOptions} selected={f.customer} />
        <MultiSelect name="status" label="Status" allLabel="All statuses" options={statusOptions} selected={f.status} />
        <MultiSelect name="type" label="Project type" allLabel="All types" options={typeOptions} selected={f.type} />
        <MultiSelect name="brand" label="Brand" allLabel="All brands" options={brandOptions} selected={f.brand} />
        <div>
          <label className="label" htmlFor="pr-market">Market</label>
          <select id="pr-market" name="market" defaultValue={f.market ?? ""} className="field">
            <option value="">All markets</option>
            {MARKETS.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="pr-from">Submitted from</label>
          <input id="pr-from" type="date" name="from" defaultValue={f.from} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="pr-to">Submitted to</label>
          <input id="pr-to" type="date" name="to" defaultValue={f.to} className="field" />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button className="btn btn-primary">Apply filters</button>
          {filtered && (
            <Link href="/projects/reports" className="btn btn-secondary">
              Reset
            </Link>
          )}
          <span className="ml-auto text-xs">
            {rows.length} of {all.length} projects
          </span>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="bento-green">
          <p className="font-display text-xs uppercase tracking-wide text-white/80">Approved spend</p>
          <p className="mt-1 font-display text-2xl font-medium sm:text-3xl">{formatAed(t.approvedSpend)}</p>
          <p className="text-xs text-white/85">{t.sirocco > 0 ? `incl. ${formatAed(t.sirocco)} Sirocco` : "Live, paused and completed"}</p>
        </div>
        <Tile label="Waiting approval" value={formatAed(t.waitingSpend)} sub={`${t.waiting} request${t.waiting === 1 ? "" : "s"}`} />
        <Tile label="Projects" value={t.projects.toLocaleString()} sub={`${t.live} live · ${t.completed} completed`} />
        <Tile
          label="PICOS delivered"
          value={t.negotiated ? `${Math.round((t.delivered / t.negotiated) * 100)}%` : "—"}
          sub={`${t.delivered} of ${t.negotiated} negotiated · avg +${t.avgUplift} pts`}
        />
      </div>

      <div className="grid gap-6">
        <SummaryTable title="By KAM" first="KAM" data={kams} max={maxKam} />
        <SummaryTable title="By customer" first="Customer" data={customers} max={maxCustomer} showOutlets />
      </div>

      <SummaryTable title="By outlet" first="Outlet" data={outlets.slice(0, 100)} more={outlets.length > 100 ? outlets.length : undefined} />

      <section className="bento overflow-x-auto">
        <h2 className="mb-3 text-xl text-brand-black">Projects</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th>KAM</th>
              <th>Outlet</th>
              <th>Status</th>
              <th className="text-right">Budget</th>
              <th className="text-right">PICOS</th>
              <th className="text-right">Delivered</th>
              <th className="text-right">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map((r) => (
              <tr key={r.id}>
                <td className="min-w-[11rem]">
                  <Link href={`/projects/${r.id}`} className="font-medium text-brand-black hover:underline">
                    {r.title}
                  </Link>
                  <span className="block text-xs">
                    {r.ref} · {r.type}
                  </span>
                </td>
                <td className="whitespace-nowrap">{r.kam}</td>
                <td className="min-w-[10rem]">
                  {r.outlet}
                  <span className="block text-xs">
                    {r.customer}
                    {r.otherOutlets ? ` · +${r.otherOutlets} outlet${r.otherOutlets === 1 ? "" : "s"}` : ""}
                  </span>
                </td>
                <td className="whitespace-nowrap text-xs">{r.statusLabel}</td>
                <td className="whitespace-nowrap text-right">
                  {formatAed(r.budget)}
                  {r.sirocco > 0 && <span className="block text-xs">{formatAed(r.sirocco)} Sirocco</span>}
                </td>
                <td className="whitespace-nowrap text-right">
                  {r.picosNow}% → <span className="font-medium text-brand-green-dark">{r.picosAfter}%</span>
                </td>
                <td className="whitespace-nowrap text-right">
                  {r.delivered}/{r.negotiated}
                </td>
                <td className="whitespace-nowrap text-right text-xs">{formatDate(r.submitted)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="text-sm">
                  No projects match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {rows.length > 300 && <p className="mt-3 text-xs">Showing 300 of {rows.length.toLocaleString()} projects. Download Excel for everything.</p>}
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bento">
      <p className="font-display text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium text-brand-black sm:text-3xl">{value}</p>
      {sub && <p className="text-xs">{sub}</p>}
    </div>
  );
}

/** Spend per row, with a thin bar for approved spend so the biggest stand out. */
function SummaryTable({ title, first, data, max, showOutlets, more }: { title: string; first: string; data: Summary[]; max?: number; showOutlets?: boolean; more?: number }) {
  return (
    <section className="bento overflow-x-auto">
      <h2 className="mb-3 text-xl text-brand-black">{title}</h2>
      <table className="table">
        <thead>
          <tr>
            <th>{first}</th>
            <th className="text-right">Projects</th>
            {showOutlets && <th className="text-right">Outlets</th>}
            <th className="text-right">Approved spend</th>
            <th className="text-right">Waiting</th>
            <th className="text-right" title="PICOS changes delivered of those negotiated">PICOS</th>
          </tr>
        </thead>
        <tbody>
          {data.map((s) => (
            <tr key={s.key}>
              <td className="min-w-[10rem]">
                <span className="font-medium text-brand-black">{s.label}</span>
                {s.sub && <span className="block text-xs">{s.sub}</span>}
              </td>
              <td className="text-right">{s.projects}</td>
              {showOutlets && <td className="text-right">{s.outlets.size}</td>}
              <td className="whitespace-nowrap text-right">
                <span className="text-brand-black">{s.approvedSpend ? formatAed(s.approvedSpend) : "—"}</span>
                {s.sirocco > 0 && <span className="block text-xs">{formatAed(s.sirocco)} Sirocco</span>}
                {max && s.approvedSpend > 0 && (
                  <span className="ml-auto mt-1 block h-1.5 rounded-full bg-brand-green" style={{ width: `${Math.max(4, (s.approvedSpend / max) * 100)}%` }} aria-hidden />
                )}
              </td>
              <td className="whitespace-nowrap text-right">{s.waitingSpend ? formatAed(s.waitingSpend) : "—"}</td>
              <td className="whitespace-nowrap text-right">
                {s.negotiated ? (
                  <>
                    {s.delivered}/{s.negotiated}
                    <span className="block text-xs">{Math.round((s.delivered / s.negotiated) * 100)}% delivered</span>
                  </>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
          {!data.length && (
            <tr>
              <td colSpan={showOutlets ? 6 : 5} className="text-sm">
                Nothing to show.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {more && <p className="mt-3 text-xs">Showing the top 100 of {more}. Download Excel for everything.</p>}
    </section>
  );
}
