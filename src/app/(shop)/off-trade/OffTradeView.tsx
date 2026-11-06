import { Fragment } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { formatAed } from "@/lib/hub";
import {
  OFF_TRADE_STATUS,
  SEGMENTS,
  TARGET_YEAR,
  VISIBILITY_MAIN,
  activationByYear,
  applyOffTradeFilters,
  byArea,
  byMarket,
  byProjectType,
  bySegment,
  byTmam,
  offTradeQuery,
  marketName,
  offTradeTotals,
  historyYears,
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
  const activation = activationByYear(stores, historyYears(stores).slice(0, 2));
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
        <Tile
          label="History"
          value={`${t.withProjects}`}
          sub={`stores with projects done${t.lastDate ? ` · last ${formatDate(t.lastDate)}` : ""}`}
          href={`/off-trade/history${offTradeQuery(f) ? `?${offTradeQuery(f)}` : ""}`}
        />
        <Tile
          label="Targets"
          value={`${t.targeted}`}
          sub={`${TARGET_YEAR} target stores · ${pct(t.targeted, t.stores)} of the universe`}
          href={`/off-trade/targets${offTradeQuery(f) ? `?${offTradeQuery(f)}` : ""}`}
        />
        <Tile
          label={`${TARGET_YEAR} cost`}
          value={formatAed(t.expected)}
          sub={t.actual || t.expectedDone ? `expected · ${formatAed(t.actual)} actual vs ${formatAed(t.expectedDone)} expected on completed` : "expected"}
        />
      </div>

      <OutletBars total={t.stores} influenced={t.influenced} activation={activation} toDate={stores.filter((x) => !x.bar && x.projects.some((p) => p.status === "completed")).length} />

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

/** Total outlets → influenced → activated each year, on one scale, for the filters chosen. */
function OutletBars({ total, influenced, activation, toDate }: { total: number; influenced: number; activation: ReturnType<typeof activationByYear>; toDate: number }) {
  const thisYear = new Date().getFullYear();
  const rows = [
    { label: "Total outlets", value: total, cls: "bg-brand-black/70", planned: 0 },
    { label: "Influenced outlets", value: influenced, cls: "bg-brand-green-dark", planned: 0, sub: "visibility in place" },
    ...activation.map((a) => ({
      label: `Activated ${a.year}`,
      value: a.activated,
      cls: "bg-brand-green",
      planned: a.year === thisYear ? a.planned : 0,
      sub: a.year === thisYear ? "so far" : "something installed",
    })),
    ...(activation.length ? [{ label: "Activated to date", value: toDate, cls: "bg-brand-green-dark", planned: 0, sub: "all years, each outlet once" }] : []),
  ];
  const of = (n: number) => (total ? (n / total) * 100 : 0);
  return (
    <section className="bento" aria-label="Outlets: total, influenced and activated">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg uppercase text-brand-black">Outlets</h2>
        <p className="text-xs">Bars aren&apos;t counted as outlets.</p>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[7.5rem_1fr] items-center gap-3 sm:grid-cols-[11rem_1fr_7rem]">
            <p className="text-sm font-medium leading-tight text-brand-black">
              {r.label}
              {r.sub && <span className="block text-xs font-normal text-brand-grey">{r.sub}</span>}
            </p>
            <div className="flex h-7 overflow-hidden rounded-md bg-brand-light" role="img" aria-label={`${r.label}: ${r.value} of ${total}${r.planned ? `, ${r.planned} more planned` : ""}`}>
              <div className={`h-full ${r.cls}`} style={{ width: `${of(r.value)}%` }} />
              {r.planned > 0 && <div className="h-full bg-brand-green/35" style={{ width: `${of(r.planned)}%` }} title={`${r.planned} more planned`} />}
            </div>
            <p className="col-start-2 -mt-2 text-sm sm:col-start-3 sm:mt-0 sm:text-right">
              <strong className="font-display text-lg text-brand-black">{r.value}</strong>
              {r.label !== "Total outlets" && <span className="ml-1.5">{Math.round(of(r.value))}%</span>}
              {r.planned > 0 && <span className="block text-xs">+{r.planned} planned</span>}
            </p>
          </div>
        ))}
      </div>
    </section>
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
