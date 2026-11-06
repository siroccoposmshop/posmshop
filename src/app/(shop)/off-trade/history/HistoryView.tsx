import Link from "next/link";
import { formatDate } from "@/lib/format";
import { formatAed } from "@/lib/hub";
import {
  OFF_TRADE_PROJECT_TYPES,
  activationByYear,
  applyOffTradeFilters,
  historyBy,
  historyRows,
  historyYears,
  marketName,
  offTradeQuery,
  type HistorySummary,
  type OffTradeFilters,
  type StoreView,
  type YearActivation,
} from "@/lib/off-trade";
import { OffTradeImportForm } from "../import/ImportForm";
import { Card, FilterBar, Tile } from "../ui";

/** Everything installed (completed projects), by category, area, market and TM, with the full list. */
export function HistoryView({ all, f, year }: { all: StoreView[]; f: OffTradeFilters; year: number | null }) {
  const stores = applyOffTradeFilters(all, f);
  const years = historyYears(stores);
  const rows = historyRows(stores, year);
  const qs = offTradeQuery(f);
  const link = (y: number | null) => `/off-trade/history?${[qs, y ? `year=${y}` : ""].filter(Boolean).join("&")}`;
  const items = rows.reduce((n, r) => n + r.qty, 0);
  const storeCount = new Set(rows.map((r) => r.store.id)).size;
  const cost = rows.reduce((n, r) => n + Number(r.project.actual_cost_aed ?? 0), 0);
  const byType = historyBy(rows, (r) => r.project.type).sort(
    (a, b) => OFF_TRADE_PROJECT_TYPES.indexOf(a.key as never) - OFF_TRADE_PROJECT_TYPES.indexOf(b.key as never),
  );
  const yearCols = year ? [] : [...years].reverse();
  const activation = activationByYear(stores, years);
  // Year-on-year change in the category table: the latest year against the one before.
  const [prevY, lastY] = yearCols.slice(-2);
  const change = yearCols.length >= 2 ? { from: prevY, to: lastY } : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/off-trade${qs ? `?${qs}` : ""}`} className="text-sm underline">
            ← Off trade
          </Link>
          <h1 className="accent-square mt-1 text-3xl text-brand-black">History</h1>
          <p className="mt-1 text-sm">Outlets activated each year, and everything installed by category, store, area and TM.</p>
        </div>
        <div className="flex rounded-full bg-white p-1 ring-1 ring-black/10" role="group" aria-label="Year">
          {[null, ...years].map((y) => (
            <Link
              key={y ?? "all"}
              href={link(y)}
              aria-current={year === y ? "true" : undefined}
              className={`rounded-full px-3 py-1.5 font-display text-sm font-medium uppercase ${year === y ? "bg-brand-green text-white" : "text-brand-grey hover:text-brand-black"}`}
            >
              {y ?? "All years"}
            </Link>
          ))}
        </div>
      </div>

      {activation.length > 0 && <Activation data={activation} selected={year} />}

      <FilterBar all={all} f={f} shown={stores.length} action="/off-trade/history" keep={year ? { year: String(year) } : undefined} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="bento-green">
          <p className="font-display text-xs uppercase tracking-wide text-white/80">Items installed</p>
          <p className="mt-1 font-display text-3xl font-medium">{items.toLocaleString()}</p>
          <p className="text-xs text-white/85">{year ?? "all years"}</p>
        </div>
        <Tile label="Stores" value={`${storeCount}`} sub={`of ${stores.length} in these filters`} />
        <Tile label="Projects done" value={`${rows.length}`} />
        <Tile label="Cost" value={formatAed(cost)} sub="actual" />
      </div>

      {activation.length > 0 && <YearByYear stores={stores} activation={activation} />}

      <Card title="By category" meta={`${items} items in ${storeCount} stores`}>
        <table className="table">
          <thead>
            <tr>
              <th>Category</th>
              <th className="text-right">Items</th>
              <th className="text-right">Stores</th>
              {yearCols.map((y) => (
                <th key={y} className="text-right">
                  {y}
                </th>
              ))}
              {change && <th className="text-right">Change</th>}
              <th className="text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {byType.map((r) => (
              <tr key={r.key}>
                <td className="font-medium text-brand-black">{r.label}</td>
                <td className="text-right font-medium text-brand-black">{r.items}</td>
                <td className="text-right">{r.stores}</td>
                {yearCols.map((y) => (
                  <td key={y} className="whitespace-nowrap text-right">
                    {r.byYear[y] ? (
                      <>
                        {r.byYear[y].items}
                        <span className="block text-xs">
                          in {r.byYear[y].stores} store{r.byYear[y].stores === 1 ? "" : "s"}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                ))}
                {change && <ChangeCell from={r.byYear[change.from]?.items ?? 0} to={r.byYear[change.to]?.items ?? 0} />}
                <td className="whitespace-nowrap text-right">{r.cost ? formatAed(r.cost) : "—"}</td>
              </tr>
            ))}
            {!byType.length && (
              <tr>
                <td colSpan={4 + yearCols.length + (change ? 1 : 0)} className="text-sm">
                  Nothing recorded yet. Upload the history below, or add projects on each store&apos;s page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <HistoryTable title="By area" first="Area" data={historyBy(rows, (r) => r.store.area)} />
      <HistoryTable title="By market" first="Market" data={historyBy(rows, (r) => r.store.market, (k) => marketName(k))} />
      <HistoryTable title="By TM" first="TM" data={historyBy(rows, (r) => r.store.tmam)} />
      <HistoryTable title="By store" first="Store" data={historyBy(rows, (r) => r.store.id, (id) => stores.find((s) => s.id === id)?.name ?? id)} />

      <Card title="Everything installed" meta={`${rows.length} project${rows.length === 1 ? "" : "s"}`}>
        <table className="table">
          <thead>
            <tr>
              <th>Completed</th>
              <th>Store</th>
              <th>Area</th>
              <th>TM</th>
              <th>What</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 1000).map((r) => (
              <tr key={r.project.id}>
                <td className="whitespace-nowrap">{r.project.completed_date ? formatDate(r.project.completed_date) : "—"}</td>
                <td className="min-w-[12rem]">
                  <Link href={`/off-trade/stores/${r.store.id}`} className="font-medium text-brand-black hover:underline">
                    {r.store.name}
                  </Link>
                  <span className="block text-xs">{r.store.chain ?? ""}</span>
                </td>
                <td className="whitespace-nowrap">{r.store.area ?? "—"}</td>
                <td className="whitespace-nowrap">{r.store.tmam ?? "—"}</td>
                <td>
                  <span className="text-brand-black">{r.project.type}</span>
                  <span className="block text-xs">{[r.project.item, r.project.brand].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="text-right">{r.qty}</td>
                <td className="whitespace-nowrap text-right">{r.project.actual_cost_aed != null ? formatAed(Number(r.project.actual_cost_aed)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Upload history" meta="Excel">
        <div className="space-y-3">
          <p className="text-sm">
            A <strong>Retail KPI tracker</strong> (2025 or 2026 Retail KPIs) is read as it is, for the year in the file name: a Y in Q1–Q4 is
            saved as done at the end of that quarter; from 2026, 1 (locked in) and 0 (planned) show under Targets. Upload a newer version
            any time: rows are updated, and ones taken out of the file are removed.
          </p>
          <p className="text-sm">
            Or one row per thing installed: <strong>Store code</strong> (or <strong>Store name</strong> and <strong>Chain</strong> until the codes
            are in), <strong>Type</strong> (Branding, Perfect shelf, Cold room, Fridge, FSU, Takeover), <strong>Item</strong>,{" "}
            <strong>Brand</strong>, <strong>Quantity</strong>, <strong>Completed date</strong>, <strong>Actual cost</strong>, Notes. Uploading
            the same rows again updates them rather than adding duplicates.{" "}
            <a href="/off-trade/history/template" className="underline">
              Download the template
            </a>
            .
          </p>
          <OffTradeImportForm />
        </div>
      </Card>
    </div>
  );
}

const signed = (n: number, digits = 0) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(digits)}`;

function ChangeCell({ from, to }: { from: number; to: number }) {
  const d = to - from;
  return (
    <td className={`whitespace-nowrap text-right font-medium ${d > 0 ? "text-brand-green-dark" : d < 0 ? "text-brand-red" : ""}`}>
      {from || to ? signed(d) : "—"}
      {from > 0 && d !== 0 && <span className="block text-xs font-normal">{signed((d / from) * 100)}%</span>}
    </td>
  );
}

/** The headline: outlets against outlets activated, per year, and the change year on year. */
function Activation({ data, selected }: { data: YearActivation[]; selected: number | null }) {
  const max = Math.max(...data.map((d) => d.outlets), 1);
  const last = data.at(-1)!;
  const prev = data.length > 1 ? data.at(-2)! : null;
  const more = prev ? last.activated - prev.activated : 0;
  const pts = prev ? last.pct - prev.pct : 0;
  const thisYear = new Date().getFullYear();
  const tone = (n: number) => (n > 0 ? "text-brand-green-dark" : n < 0 ? "text-brand-red" : "text-brand-black");
  return (
    <section className="bento space-y-4" aria-label="Outlets activated by year">
      <div>
        <h2 className="font-display text-lg uppercase text-brand-black">Outlets activated</h2>
        <p className="text-xs">
          An outlet is activated in a year when something was installed in it that year. Outlets count from the year they opened (set on the
          store page, or an Opening year column in the store list). Bars are counted on the side, not as outlets.
        </p>
      </div>
      <div className={`grid gap-3 ${prev ? "md:grid-cols-[repeat(var(--n),minmax(0,1fr))_minmax(0,0.9fr)]" : ""}`} style={{ ["--n" as string]: data.length }}>
        {data.map((d) => (
          <div key={d.year} className={`rounded-xl p-4 ring-1 ${selected === d.year ? "bg-brand-green-tint ring-brand-green" : "bg-white ring-black/10"}`}>
            <p className="font-display text-sm font-medium uppercase tracking-wide text-brand-black">
              {d.year}
              {d.year === thisYear && <span className="ml-1 text-xs normal-case text-brand-grey">so far</span>}
            </p>
            <p className="mt-1 font-display text-4xl font-bold text-brand-black">{Math.round(d.pct)}%</p>
            <p className="text-sm">
              <strong className="text-brand-black">{d.activated}</strong> of {d.outlets} outlets activated
              {d.bars > 0 && <span className="text-xs"> · +{d.bars} bar{d.bars === 1 ? "" : "s"}</span>}
            </p>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-brand-light" style={{ width: `${(d.outlets / max) * 100}%` }} role="img" aria-label={`${d.activated} of ${d.outlets} outlets activated${d.planned ? `, ${d.planned} more planned` : ""}`}>
              <div className="h-full bg-brand-green" style={{ width: `${d.outlets ? (d.activated / d.outlets) * 100 : 0}%` }} />
              {d.planned > 0 && <div className="h-full bg-brand-green/35" style={{ width: `${(d.planned / d.outlets) * 100}%` }} />}
            </div>
            {d.planned > 0 && (
              <p className="mt-1.5 text-xs">
                +{d.planned} more planned → {Math.round(((d.activated + d.planned) / d.outlets) * 100)}% if all are done
              </p>
            )}
          </div>
        ))}
        {prev && (
          <div className="rounded-xl bg-brand-black p-4 text-white">
            <p className="font-display text-sm font-medium uppercase tracking-wide text-white/80">
              {last.year} vs {prev.year}
            </p>
            <p className={`mt-1 font-display text-4xl font-bold ${more >= 0 ? "text-brand-green" : "text-brand-red"}`}>{signed(more)}</p>
            <p className="text-sm text-white/90">activation{Math.abs(more) === 1 ? "" : "s"}</p>
            <p className="mt-2 text-sm text-white/90">
              <strong className={more >= 0 && pts >= 0 ? "text-brand-green" : "text-brand-red"}>{signed(pts, 1)} pts</strong> ({Math.round(prev.pct)}% → {Math.round(last.pct)}%)
              {prev.activated > 0 && more !== 0 && (
                <span className="block text-xs text-white/75">
                  {Math.round(Math.abs(more / prev.activated) * 100)}% {more > 0 ? "more" : "fewer"} outlets activated
                </span>
              )}
              {last.year === thisYear && <span className="block text-xs text-white/75">{last.year} is still in progress.</span>}
            </p>
          </div>
        )}
      </div>
      {prev && last.outlets !== prev.outlets && (
        <p className={`text-xs ${tone(last.outlets - prev.outlets)}`}>
          Outlets {signed(last.outlets - prev.outlets)} ({prev.outlets} → {last.outlets}).
        </p>
      )}
    </section>
  );
}

/** Per year: how many of each project type were done, in how many outlets, against the market's size. */
function YearByYear({ stores, activation }: { stores: StoreView[]; activation: YearActivation[] }) {
  const thisYear = new Date().getFullYear();
  const cols = activation.map((a) => {
    const rows = historyRows(stores, a.year).filter((r) => !r.store.bar);
    const byType = new Map<string, { items: number; outlets: Set<string> }>();
    for (const r of rows) {
      const e = byType.get(r.project.type) ?? { items: 0, outlets: new Set<string>() };
      e.items += r.qty;
      e.outlets.add(r.store.id);
      byType.set(r.project.type, e);
    }
    return { ...a, byType, items: rows.reduce((n, r) => n + r.qty, 0) };
  });
  const types = OFF_TRADE_PROJECT_TYPES.filter((t) => cols.some((c) => c.byType.has(t)));
  const cell = (items: number, outlets: number, of: number) =>
    items ? (
      <>
        <span className="font-display text-lg font-medium text-brand-black">{items}</span>
        <span className="block text-xs">
          in {outlets} outlet{outlets === 1 ? "" : "s"} · {of ? Math.round((outlets / of) * 100) : 0}%
        </span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-brand-light">
          <span className="block h-full rounded-full bg-brand-green" style={{ width: `${of ? Math.min(100, (outlets / of) * 100) : 0}%` }} />
        </span>
      </>
    ) : (
      <span className="text-brand-grey">—</span>
    );
  return (
    <Card title="Year by year" meta="projects done against the market" open>
      <table className="table">
        <thead>
          <tr>
            <th>Project type</th>
            {cols.map((c) => (
              <th key={c.year} className="min-w-[6.5rem] text-right sm:min-w-[9rem]">
                {c.year}
                {c.year === thisYear ? " so far" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="bg-brand-light/60">
            <td className="font-medium text-brand-black">
              Market size
              <span className="block text-xs font-normal">outlets</span>
            </td>
            {cols.map((c) => (
              <td key={c.year} className="text-right font-display text-lg font-medium text-brand-black">
                {c.outlets}
              </td>
            ))}
          </tr>
          {types.map((t) => (
            <tr key={t}>
              <td className="font-medium text-brand-black">{t}</td>
              {cols.map((c) => {
                const e = c.byType.get(t);
                return (
                  <td key={c.year} className="text-right">
                    {cell(e?.items ?? 0, e?.outlets.size ?? 0, c.outlets)}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t-2 border-brand-green">
            <td className="font-medium text-brand-black">
              All projects
              <span className="block text-xs font-normal">outlets activated</span>
            </td>
            {cols.map((c) => (
              <td key={c.year} className="text-right">
                {cell(c.items, c.activated, c.outlets)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs">Items installed, in how many outlets, and that as a % of the outlets in the market that year. Bars aren&apos;t counted.</p>
    </Card>
  );
}

function HistoryTable({ title, first, data }: { title: string; first: string; data: HistorySummary[] }) {
  return (
    <Card title={title} meta={`${data.length} ${first.toLowerCase()}${data.length === 1 ? "" : "s"}`}>
      <table className="table">
        <thead>
          <tr>
            <th>{first}</th>
            <th className="text-right">Items</th>
            <th className="text-right">Stores</th>
            <th className="text-right">Projects</th>
            <th className="text-right">Cost</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.key}>
              <td className="font-medium text-brand-black">{r.label}</td>
              <td className="text-right">{r.items}</td>
              <td className="text-right">{r.stores}</td>
              <td className="text-right">{r.projects}</td>
              <td className="whitespace-nowrap text-right">{r.cost ? formatAed(r.cost) : "—"}</td>
            </tr>
          ))}
          {!data.length && (
            <tr>
              <td colSpan={5} className="text-sm">
                Nothing recorded.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
