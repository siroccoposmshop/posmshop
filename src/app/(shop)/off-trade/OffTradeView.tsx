import { Fragment } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { formatAed } from "@/lib/hub";
import {
  OFF_TRADE_STATUS,
  SEGMENTS,
  TARGET_YEAR,
  VISIBILITY_MAIN,
  applyOffTradeFilters,
  byArea,
  byMarket,
  byProjectType,
  bySegment,
  byTmam,
  offTradeQuery,
  marketName,
  offTradeTotals,
  yearOf,
  type OffTradeSummary,
  type OffTradeFilters,
  type StoreView,
} from "@/lib/off-trade";
import { Card, FilterBar, Tile } from "./ui";

/** The off-trade dashboard for a set of stores (all = the full universe, for the filter lists). */
export function OffTradeView({ all, f }: { all: StoreView[]; f: OffTradeFilters }) {
  const stores = applyOffTradeFilters(all, f);
  const t = offTradeTotals(stores);
  const types = byProjectType(stores);
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="accent-square text-3xl text-brand-black">Off trade</h1>
          <p className="mt-1 text-sm">Store universe, influence, what&apos;s been done and the {TARGET_YEAR} plan.</p>
        </div>
      </div>

      <FilterBar all={all} f={f} shown={stores.length} action="/off-trade" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="bento-green">
          <p className="font-display text-xs uppercase tracking-wide text-white/80">Universe</p>
          <p className="mt-1 font-display text-3xl font-medium">
            {t.stores}
            {t.bars > 0 && <span className="ml-2 align-middle text-sm font-normal text-white/85">+{t.bars} bars</span>}
          </p>
          <p className="text-xs text-white/85">{segmentLine(t)}</p>
        </div>
        <Tile label="Influenced" value={`${t.influenced}`} sub={`${pct(t.influenced, t.stores)} of stores · ${t.stores - t.influenced} not influenced`} />
        <Tile label="Projects done" value={`${t.withProjects}`} sub={`stores${t.lastDate ? ` · last ${formatDate(t.lastDate)}` : ""}`} />
        <Tile
          label={`${TARGET_YEAR} targets`}
          value={`${t.targeted}`}
          sub={`stores · ${pct(t.targeted, t.stores)} of the universe · see progress`}
          href={`/off-trade/targets${offTradeQuery(f) ? `?${offTradeQuery(f)}` : ""}`}
        />
        <Tile
          label={`${TARGET_YEAR} cost`}
          value={formatAed(t.expected)}
          sub={t.actual || t.expectedDone ? `expected · ${formatAed(t.actual)} actual vs ${formatAed(t.expectedDone)} expected on completed` : "expected"}
        />
      </div>

      <VisibilityTable rows={byArea(stores)} total={t} />
      <SummaryTable title="By market" first="Market" rows={byMarket(stores)} />
      <SummaryTable title="By area" first="Area" rows={byArea(stores)} />
      <SummaryTable title="By TM" first="TM" rows={byTmam(stores)} />
      <SummaryTable title="Segment mix" first="Segment" rows={bySegment(stores)} hideSegments />

      <Card title="By project type" meta={`${types.length} type${types.length === 1 ? "" : "s"}`}>
        {!types.length ? (
          <p className="text-sm">No projects recorded for these stores yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th className="text-right">Stores done</th>
                <th className="text-right">Last done</th>
                <th className="text-right">Planned {TARGET_YEAR}</th>
                <th className="text-right">Expected {TARGET_YEAR}</th>
                <th className="text-right">Actual {TARGET_YEAR}</th>
              </tr>
            </thead>
            <tbody>
              {types.map((r) => (
                <tr key={r.type}>
                  <td className="font-medium text-brand-black">{r.type}</td>
                  <td className="text-right">{r.storesDone || "—"}</td>
                  <td className="whitespace-nowrap text-right">{r.last ? formatDate(r.last) : "—"}</td>
                  <td className="text-right">{r.planned || "—"}</td>
                  <td className="whitespace-nowrap text-right">{r.expected ? formatAed(r.expected) : "—"}</td>
                  <td className="whitespace-nowrap text-right">{r.actual ? formatAed(r.actual) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Stores" meta={`${stores.length} store${stores.length === 1 ? "" : "s"}`}>
        <table className="table">
          <thead>
            <tr>
              <th>Store</th>
              <th>Area</th>
              <th>TM</th>
              <th>Segment</th>
              {VISIBILITY_MAIN.map((m) => (
                <th key={m} className="text-center">
                  {m}
                </th>
              ))}
              <th>Last project</th>
              <th>{TARGET_YEAR} plan</th>
              <th className="text-right">{TARGET_YEAR} cost</th>
            </tr>
          </thead>
          <tbody>
            {stores.slice(0, 500).map((s) => {
              const year = s.projects.filter((p) => yearOf(p) === TARGET_YEAR && p.status !== "cancelled");
              const exp = year.reduce((n, p) => n + Number(p.expected_cost_aed ?? 0), 0);
              const act = year.filter((p) => p.status === "completed").reduce((n, p) => n + Number(p.actual_cost_aed ?? 0), 0);
              return (
                <tr key={s.id}>
                  <td className="min-w-[12rem]">
                    <Link href={`/off-trade/stores/${s.id}`} className="font-medium text-brand-black hover:underline">
                      {s.name}
                    </Link>
                    <span className="block text-xs">
                      {s.chain ? `${s.chain} · ` : ""}
                      {s.code.startsWith("TBC-") ? "code tbc" : `#${s.code}`}
                      {s.store_type && !/retail/i.test(s.store_type) ? ` · ${s.store_type}` : ""}
                    </span>
                    {s.influenced && <span className="badge mt-0.5 bg-brand-green-tint text-brand-green-dark">Influenced</span>}
                  </td>
                  <td className="whitespace-nowrap">
                    {s.area ?? "—"}
                    {s.market && <span className="block text-xs">{marketName(s.market)}</span>}
                  </td>
                  <td className="whitespace-nowrap">{s.tmam ?? "—"}</td>
                  <td className="whitespace-nowrap">{s.segment ?? "—"}</td>
                  {VISIBILITY_MAIN.map((m) => (
                    <td key={m} className="text-center">
                      {s.vis.totals[m] > 0 ? <span className="font-medium text-brand-green-dark">✓{s.vis.totals[m] > 1 ? ` ${s.vis.totals[m]}` : ""}</span> : <span className="text-brand-grey/40">–</span>}
                    </td>
                  ))}
                  <td className="whitespace-nowrap">
                    {s.last ? (
                      <>
                        {s.last.type}
                        <span className="block text-xs">{s.last.completed_date ? formatDate(s.last.completed_date) : ""}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {s.targets.length ? (
                      <>
                        {s.targets.map((p) => p.type).join(", ")}
                        <span className="block text-xs">
                          {s.targets
                            .map((p) => (p.status === "completed" && p.completed_date ? `Done ${formatDate(p.completed_date)}` : p.planned_date ? formatDate(p.planned_date) : OFF_TRADE_STATUS[p.status]))
                            .join(", ")}
                        </span>
                      </>
                    ) : s.targeted ? (
                      <span className="badge bg-brand-green-tint text-brand-green-dark">Target · project tbc</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {exp ? formatAed(exp) : "—"}
                    {act > 0 && <span className={`block text-xs ${act > exp ? "text-brand-red" : "text-brand-green-dark"}`}>{formatAed(act)} actual</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {stores.length > 500 && <p className="mt-3 text-xs">Showing 500 of {stores.length} stores. Narrow the filters to see the rest.</p>}
      </Card>
    </div>
  );
}

const segmentLine = (s: OffTradeSummary) =>
  SEGMENTS.map((x) => (s.segments[x.short] ? `${x.short} ${s.segments[x.short]}` : ""))
    .concat(Object.entries(s.segments).filter(([k]) => !SEGMENTS.some((x) => x.short === k)).map(([k, n]) => `${k} ${n}`))
    .filter(Boolean)
    .join(" · ") || "—";



/** Stores with each main visibility title in place, by area. */
function VisibilityTable({ rows, total }: { rows: OffTradeSummary[]; total: OffTradeSummary }) {
  const cell = (n: number | undefined, of: number) => (
    <td className="whitespace-nowrap text-right">
      {n ? (
        <>
          {n}
          <span className="block text-xs">{Math.round((n / of) * 100)}%</span>
        </>
      ) : (
        "—"
      )}
    </td>
  );
  return (
    <Card title="Visibility in place" meta={`${total.influenced} of ${total.stores} stores influenced`}>
      <p className="mb-3 text-sm">Stores with each type of visibility today (from the Visibility Master File). Bars sit inside their store and are shown as an addition, not counted as stores. T-shirts are logged but not counted. Open a store for the brands and units.</p>
      <table className="table">
        <thead>
          <tr>
            <th>Area</th>
            <th className="text-right">Stores</th>
            <th className="text-right">Influenced</th>
            {VISIBILITY_MAIN.map((m) => (
              <th key={m} className="text-right">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="font-medium text-brand-black">{r.label}</td>
              <td className="whitespace-nowrap text-right">
                {r.stores}
                {r.bars > 0 && <span className="block text-xs">+{r.bars} bar{r.bars === 1 ? "" : "s"}</span>}
              </td>
              {cell(r.influenced, r.stores)}
              {VISIBILITY_MAIN.map((m) => (
                <Fragment key={m}>{cell(r.assets[m], r.stores)}</Fragment>
              ))}
            </tr>
          ))}
          <tr className="font-medium">
            <td className="text-brand-black">Total</td>
            <td className="whitespace-nowrap text-right text-brand-black">
              {total.stores}
              {total.bars > 0 && <span className="block text-xs font-normal">+{total.bars} bars</span>}
            </td>
            {cell(total.influenced, total.stores)}
            {VISIBILITY_MAIN.map((m) => (
              <Fragment key={m}>{cell(total.assets[m], total.stores)}</Fragment>
            ))}
          </tr>
        </tbody>
      </table>
    </Card>
  );
}

function SummaryTable({ title, first, rows, compact, hideSegments }: { title: string; first: string; rows: OffTradeSummary[]; compact?: boolean; hideSegments?: boolean }) {
  return (
    <Card title={title} meta={`${rows.length} ${first.toLowerCase()}${rows.length === 1 ? "" : "s"}`}>
      <table className="table">
        <thead>
          <tr>
            <th>{first}</th>
            <th className="text-right">Stores</th>
            {!hideSegments && <th>Segment mix</th>}
            <th className="text-right">Influenced</th>
            <th className="text-right">Projects done</th>
            <th className="text-right">{TARGET_YEAR} targets</th>
            {!compact && <th className="text-right">Expected {TARGET_YEAR}</th>}
            {!compact && <th className="text-right">Actual {TARGET_YEAR}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="min-w-[8rem] font-medium text-brand-black">{r.label}</td>
              <td className="whitespace-nowrap text-right">
                {r.stores}
                {r.bars > 0 && <span className="block text-xs">+{r.bars} bar{r.bars === 1 ? "" : "s"}</span>}
              </td>
              {!hideSegments && <td className="whitespace-nowrap text-xs">{segmentLine(r)}</td>}
              <td className="whitespace-nowrap text-right">
                {r.influenced}
                <span className="block text-xs">{r.stores ? `${Math.round((r.influenced / r.stores) * 100)}%` : ""}</span>
              </td>
              <td className="whitespace-nowrap text-right">
                {r.withProjects || "—"}
                {r.lastDate && <span className="block text-xs">last {formatDate(r.lastDate)}</span>}
              </td>
              <td className="text-right">{r.targeted || "—"}</td>
              {!compact && <td className="whitespace-nowrap text-right">{r.expected ? formatAed(r.expected) : "—"}</td>}
              {!compact && (
                <td className="whitespace-nowrap text-right">
                  {r.actual ? formatAed(r.actual) : "—"}
                  {r.actual > 0 && r.expectedDone > 0 && (
                    <span className={`block text-xs ${r.actual > r.expectedDone ? "text-brand-red" : "text-brand-green-dark"}`}>
                      vs {formatAed(r.expectedDone)} expected
                    </span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
