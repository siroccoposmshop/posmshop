import Link from "next/link";
import { formatDate } from "@/lib/format";
import { formatAed } from "@/lib/hub";
import {
  TARGET_YEAR,
  TARGET_YEARS,
  applyOffTradeFilters,
  marketName,
  offTradeQuery,
  storeLabel,
  targetRows,
  targetsBy,
  targetsByQuarter,
  type OffTradeFilters,
  type StoreView,
  type TargetSummary,
} from "@/lib/off-trade";
import { Card, FilterBar, Meter, Tile } from "../ui";

/** The target-year KPI tracker: targets achieved, by quarter, market, area and TM. */
export function TargetsView({ all, f, year }: { all: StoreView[]; f: OffTradeFilters; year: number }) {
  const stores = applyOffTradeFilters(all, f);
  const rows = targetRows(stores, year);
  const achieved = rows.filter((r) => r.achieved).length;
  const tbc = rows.filter((r) => r.tbc).length;
  const planned = rows.length - achieved - tbc;
  const pct = rows.length ? Math.round((achieved / rows.length) * 100) : 0;
  const expected = rows.reduce((n, r) => n + r.expected, 0);
  const actual = rows.reduce((n, r) => n + r.actual, 0);
  const quarters = targetsByQuarter(rows);
  const qs = offTradeQuery(f);
  const link = (y: number) => {
    const p = new URLSearchParams(qs);
    if (y !== TARGET_YEAR) p.set("year", String(y));
    const q = p.toString();
    return `/off-trade/targets${q ? `?${q}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/off-trade${qs ? `?${qs}` : ""}`} className="text-sm underline">
            ← Off trade
          </Link>
          <h1 className="accent-square mt-1 text-3xl text-brand-black">Targets</h1>
          <p className="mt-1 text-sm">
            {year} target stores and how many are achieved (a {year} project completed), by quarter, market, area and TM.
          </p>
        </div>
        <div className="flex rounded-full bg-white p-1 ring-1 ring-black/10" role="group" aria-label="Year">
          {TARGET_YEARS.map((y) => (
            <Link
              key={y}
              href={link(y)}
              aria-current={year === y ? "true" : undefined}
              className={`rounded-full px-3 py-1.5 font-display text-sm font-medium uppercase ${year === y ? "bg-brand-green text-white" : "text-brand-grey hover:text-brand-black"}`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      <FilterBar all={all} f={f} shown={stores.length} action="/off-trade/targets" keep={year !== TARGET_YEAR ? { year: String(year) } : undefined} />

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div className="bento-green">
          <p className="font-display text-xs uppercase tracking-wide text-white/80">Achieved</p>
          <p className="mt-1 font-display text-5xl font-bold">{rows.length ? `${pct}%` : "—"}</p>
          <p className="text-sm text-white/90">
            {achieved} of {rows.length} target stores
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/25" role="img" aria-label={`${pct}% achieved`}>
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <Tile label="Target stores" value={`${rows.length}`} sub={`of ${stores.length} stores`} />
        <Tile label="Planned" value={`${planned}`} sub="project chosen, not done yet" />
        <Tile label="Project tbc" value={`${tbc}`} sub="target, project not chosen" />
        <Tile label={`${year} cost`} value={formatAed(expected)} sub={actual ? `expected · ${formatAed(actual)} actual so far` : "expected"} />
      </div>

      <Card title="By quarter" meta={`${achieved} achieved so far`} open>
        <table className="table">
          <thead>
            <tr>
              <th>Quarter</th>
              <th className="text-right">Due</th>
              <th className="text-right">Achieved of due</th>
              <th>Progress</th>
              <th className="text-right">Achieved in quarter</th>
              <th className="text-right">Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {quarters.map((q) => (
              <tr key={q.quarter}>
                <td className="font-medium text-brand-black">{q.quarter}</td>
                <td className="text-right">{q.due || "—"}</td>
                <td className="text-right">{q.due ? q.dueAchieved : "—"}</td>
                <td className="w-64">{q.due ? <Meter value={q.dueAchieved} of={q.due} wide /> : <span className="text-xs">—</span>}</td>
                <td className="text-right">{q.achievedIn || "—"}</td>
                <td className="text-right">
                  {q.cumulative}
                  <span className="block text-xs">{rows.length ? `${Math.round((q.cumulative / rows.length) * 100)}% of all` : ""}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <TargetTable title="By TM" first="TM" data={targetsBy(rows, (r) => r.store.tmam)} open />
      <TargetTable title="By market" first="Market" data={targetsBy(rows, (r) => r.store.market, (k) => marketName(k))} />
      <TargetTable title="By area" first="Area" data={targetsBy(rows, (r) => r.store.area)} />

      <Card title="Target stores" meta={`${rows.length} store${rows.length === 1 ? "" : "s"}`} sticky>
        <table className="table">
          <thead>
            <tr>
              <th>Store</th>
              <th>Area</th>
              <th>TM</th>
              <th>Project</th>
              <th>Due</th>
              <th>Status</th>
              <th className="text-right">Expected / actual</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((r) => (
              <tr key={r.store.id}>
                <td className="min-w-[12rem]">
                  <Link href={`/off-trade/stores/${r.store.id}`} className="font-medium text-brand-black hover:underline">
                    {storeLabel(r.store.name, r.store.chain)}
                  </Link>
                  <span className="block text-xs">{r.store.chain ?? ""}</span>
                </td>
                <td className="whitespace-nowrap">{r.store.area ?? "—"}</td>
                <td className="whitespace-nowrap">{r.store.tmam ?? "—"}</td>
                <td className="whitespace-nowrap">
                  {r.types.join(", ") || "—"}
                  {r.items > 1 && <span className="block text-xs">{r.itemsDone} of {r.items} done</span>}
                </td>
                <td className="whitespace-nowrap">
                  {r.dueQ ?? "—"}
                  {r.due && <span className="block text-xs">{formatDate(r.due)}</span>}
                </td>
                <td className="whitespace-nowrap">
                  {r.achieved ? (
                    <span className="badge bg-brand-green text-white">Achieved{r.doneDate ? ` · ${formatDate(r.doneDate)}` : ""}</span>
                  ) : r.tbc ? (
                    <span className="badge bg-brand-light text-brand-grey">Project tbc</span>
                  ) : (
                    <span className="badge bg-white text-brand-black ring-1 ring-black/15">Planned</span>
                  )}
                </td>
                <td className="whitespace-nowrap text-right">
                  {r.expected ? formatAed(r.expected) : "—"}
                  {r.actual > 0 && <span className={`block text-xs ${r.actual > r.expected ? "text-brand-red" : "text-brand-green-dark"}`}>{formatAed(r.actual)} actual</span>}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="text-sm">
                  No target stores for these filters. Mark stores as a {year} target on their page, or give them a {year} project.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function TargetTable({ title, first, data, open }: { title: string; first: string; data: TargetSummary[]; open?: boolean }) {
  return (
    <Card title={title} meta={`${data.length} ${first.toLowerCase()}${data.length === 1 ? "" : "s"}`} open={open}>
      <table className="table">
        <thead>
          <tr>
            <th>{first}</th>
            <th className="text-right">Targets</th>
            <th className="text-right">Achieved</th>
            <th>Progress</th>
            <th className="text-right">Project tbc</th>
            <th className="text-right">Expected</th>
            <th className="text-right">Actual</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.key}>
              <td className="font-medium text-brand-black">{r.label}</td>
              <td className="text-right">{r.targets}</td>
              <td className="text-right">{r.achieved}</td>
              <td className="w-64">
                <Meter value={r.achieved} of={r.targets} wide />
              </td>
              <td className="text-right">{r.tbc || "—"}</td>
              <td className="whitespace-nowrap text-right">{r.expected ? formatAed(r.expected) : "—"}</td>
              <td className="whitespace-nowrap text-right">{r.actual ? formatAed(r.actual) : "—"}</td>
            </tr>
          ))}
          {!data.length && (
            <tr>
              <td colSpan={7} className="text-sm">
                No target stores.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
