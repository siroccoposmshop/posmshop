import Link from "next/link";
import { formatDate } from "@/lib/format";
import { formatAed } from "@/lib/hub";
import { MARKETS } from "@/lib/markets";
import {
  STATUS_GROUPS,
  byCustomer,
  byKam,
  byOutlet,
  byPicosItem,
  filtersToQuery,
  picosReportLines,
  totals,
  type PicosShow,
  type ProjectReportFilters,
  type ProjectReportRow,
  type Summary,
} from "@/lib/project-reports";
import { MultiSelect } from "@/components/MultiSelect";

/** The Project reports dashboard for a set of rows (all = everything in scope, for the filter lists). */
export function ReportsView({ rows, all, f, team, show = "pending" }: { rows: ProjectReportRow[]; all: ProjectReportRow[]; f: ProjectReportFilters; team: boolean; show?: PicosShow }) {
  const t = totals(rows);
  const kams = byKam(rows);
  const customers = byCustomer(rows);
  const outlets = byOutlet(rows);
  const qs = filtersToQuery(f);
  const picosAll = picosReportLines(rows);
  const picosShown = picosAll.filter((l) => show === "all" || (show === "delivered" ? !!l.deliveredAt : !l.deliveredAt));
  const picosPending = picosAll.filter((l) => !l.deliveredAt).length;
  const picosOverdue = picosAll.filter((l) => l.overdue).length;
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
          <p className="mt-1 text-sm">{team ? "Your team's projects" : "All projects"} · spend, PICOS and progress by project lead, customer and outlet.</p>
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
        <MultiSelect name="kam" label="Project lead" allLabel="All project leads" options={kamOptions} selected={f.kam} />
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
          <p className="font-display text-xs uppercase tracking-wide text-white/80">Spend</p>
          <p className="mt-1 font-display text-2xl font-medium sm:text-3xl">{formatAed(t.approvedSpend)}</p>
          <p className="text-xs text-white/85">
            Final cost when completed, else budget{t.sirocco > 0 ? ` · incl. ${formatAed(t.sirocco)} Sirocco` : ""}
          </p>
        </div>
        <Tile label="Waiting approval" value={formatAed(t.waitingSpend)} sub={`${t.waiting} request${t.waiting === 1 ? "" : "s"}`} />
        <Tile label="Projects" value={t.projects.toLocaleString()} sub={`${t.live} live · ${t.completed} completed`} />
        <a href="#picos" className="bento block ring-brand-green transition hover:ring-2" title="See every PICOS item">
          <p className="flex items-center justify-between font-display text-xs uppercase tracking-wide">
            PICOS delivered <span aria-hidden className="text-brand-green">↓</span>
          </p>
          <p className="mt-1 font-display text-2xl font-medium text-brand-black sm:text-3xl">
            {t.negotiated ? `${Math.round((t.delivered / t.negotiated) * 100)}%` : "—"}
          </p>
          <p className="text-xs">
            {t.delivered} of {t.negotiated} negotiated · avg +{t.avgUplift} pts
          </p>
          {picosOverdue > 0 && <p className="mt-1 text-xs font-medium text-brand-red">{picosOverdue} pending on completed projects</p>}
        </a>
      </div>

      <div className="grid gap-6">
        <SummaryTable title="By project lead" first="Project lead" data={kams} max={maxKam} />
        <SummaryTable title="By customer" first="Customer" data={customers} max={maxCustomer} showOutlets />
      </div>

      <SummaryTable title="By outlet" first="Outlet" data={outlets.slice(0, 100)} more={outlets.length > 100 ? outlets.length : undefined} />

      <PicosSection lines={picosShown} all={picosAll} pending={picosPending} overdue={picosOverdue} show={show} qs={qs} />

      <section className="bento overflow-x-auto">
        <h2 className="mb-3 text-xl text-brand-black">Projects</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Project lead</th>
              <th>Outlet</th>
              <th>Status</th>
              <th className="text-right">Budget</th>
              <th className="text-right">Final cost</th>
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
                  {r.finalCost != null ? (
                    <>
                      {formatAed(r.finalCost)}
                      {r.finalCost !== r.budget && (
                        <span className={`block text-xs ${r.finalCost > r.budget ? "text-brand-red" : "text-brand-green-dark"}`}>
                          {r.finalCost > r.budget ? "+" : "−"}
                          {formatAed(Math.abs(r.finalCost - r.budget))}
                        </span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
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
                <td colSpan={9} className="text-sm">
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

/** PICOS first: every negotiated change, pending or delivered, with the project's progress. */
function PicosSection({
  lines,
  all,
  pending,
  overdue,
  show,
  qs,
}: {
  lines: ReturnType<typeof picosReportLines>;
  all: ReturnType<typeof picosReportLines>;
  pending: number;
  overdue: number;
  show: PicosShow;
  qs: string;
}) {
  const items = byPicosItem(all);
  const tab = (v: PicosShow, label: string, n: number) => (
    <a
      href={`/projects/reports?${qs ? `${qs}&` : ""}picos=${v}#picos`}
      aria-current={show === v ? "true" : undefined}
      className={`rounded-full px-3 py-1.5 font-display text-sm font-medium uppercase ${show === v ? "bg-brand-green text-white" : "text-brand-grey hover:text-brand-black"}`}
    >
      {label} <span className={show === v ? "text-white/80" : ""}>{n}</span>
    </a>
  );
  return (
    <section id="picos" className="bento scroll-mt-24 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl text-brand-black">PICOS</h2>
          <p className="text-sm">
            Every PICOS change negotiated, at each outlet, and whether it&apos;s in place.
            {overdue > 0 && <strong className="text-brand-red"> {overdue} still pending on completed projects.</strong>}
          </p>
        </div>
        <div className="flex rounded-full bg-white p-1 ring-1 ring-black/10" role="group" aria-label="Show">
          {tab("pending", "Pending", pending)}
          {tab("delivered", "Delivered", all.length - pending)}
          {tab("all", "All", all.length)}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>PICOS item</th>
              <th>Outlet</th>
              <th>Project</th>
              <th>Project lead</th>
              <th>Project status</th>
              <th className="text-right">PICOS</th>
            </tr>
          </thead>
          <tbody>
            {lines.slice(0, 400).map((l, i) => (
              <tr key={`${l.projectId}-${l.outletId ?? "main"}-${l.key}-${i}`} className={l.overdue ? "bg-brand-red/5" : ""}>
                <td className="min-w-[12rem]">
                  <span className="font-medium text-brand-black">{l.label}</span>
                  <span className="block text-xs">
                    {l.group} · {l.points} pts
                  </span>
                </td>
                <td className="min-w-[10rem]">
                  {l.outlet}
                  <span className="block text-xs">
                    {l.customer}
                    {l.outletId ? " · other outlet in the deal" : ""}
                  </span>
                </td>
                <td className="min-w-[10rem]">
                  <Link href={`/projects/${l.projectId}`} className="text-brand-black hover:underline">
                    {l.title}
                  </Link>
                  <span className="block text-xs">{l.ref}</span>
                </td>
                <td className="whitespace-nowrap">{l.kam}</td>
                <td className="whitespace-nowrap text-sm">
                  {l.status === "completed" ? (
                    <>
                      Completed
                      <span className="block text-xs">{l.completed ? formatDate(l.completed) : ""}</span>
                    </>
                  ) : (
                    <>
                      {l.statusLabel}
                      <span className="block text-xs">{l.target ? `Due ${formatDate(l.target)}` : ""}</span>
                    </>
                  )}
                </td>
                <td className="whitespace-nowrap text-right">
                  {l.deliveredAt ? (
                    <span className="text-brand-green-dark">
                      ✓ Delivered
                      <span className="block text-xs">{formatDate(l.deliveredAt)}</span>
                    </span>
                  ) : l.overdue ? (
                    <span className="badge bg-brand-red text-white">Action · project complete</span>
                  ) : (
                    <span className="badge bg-amber-500 text-white">Pending</span>
                  )}
                </td>
              </tr>
            ))}
            {!lines.length && (
              <tr>
                <td colSpan={6} className="text-sm">
                  {show === "pending" ? "Nothing pending. Every negotiated PICOS change is in place." : "No PICOS changes match."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {lines.length > 400 && <p className="mt-3 text-xs">Showing 400 of {lines.length.toLocaleString()}. Download Excel for everything.</p>}
      </div>
      {items.length > 0 && (
        <details className="group rounded-xl ring-1 ring-black/10">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 font-display text-sm font-medium uppercase tracking-wide text-brand-black">
            By PICOS item
            <span className="flex items-center gap-2 text-xs normal-case tracking-normal text-brand-grey">
              {items.length} criteria
              <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </summary>
          <div className="overflow-x-auto px-4 pb-3">
          <table className="table">
            <thead>
              <tr>
                <th>PICOS item</th>
                <th className="text-right">Negotiated</th>
                <th className="text-right">Delivered</th>
                <th className="text-right">Pending</th>
                <th className="text-right">Pending · project complete</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.key}>
                  <td className="min-w-[12rem]">
                    <span className="font-medium text-brand-black">{i.label}</span>
                    <span className="block text-xs">{i.group}</span>
                  </td>
                  <td className="text-right">{i.negotiated}</td>
                  <td className="text-right">{i.delivered}</td>
                  <td className="text-right">{i.pending || "—"}</td>
                  <td className={`text-right ${i.overdue ? "font-medium text-brand-red" : ""}`}>{i.overdue || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </details>
      )}

    </section>
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
            <th className="text-right">Spend</th>
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
