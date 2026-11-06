import Link from "next/link";
import { formatDate } from "@/lib/format";
import { formatAed } from "@/lib/hub";
import {
  OFF_TRADE_PROJECT_TYPES,
  applyOffTradeFilters,
  historyBy,
  historyRows,
  historyYears,
  marketName,
  offTradeQuery,
  type HistorySummary,
  type OffTradeFilters,
  type StoreView,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/off-trade${qs ? `?${qs}` : ""}`} className="text-sm underline">
            ← Off trade
          </Link>
          <h1 className="accent-square mt-1 text-3xl text-brand-black">Projects done</h1>
          <p className="mt-1 text-sm">Everything installed, by category, store, area and TM: how many items across how many stores.</p>
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

      <Card title="By category" meta={`${items} items in ${storeCount} stores`} open>
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
                <td className="whitespace-nowrap text-right">{r.cost ? formatAed(r.cost) : "—"}</td>
              </tr>
            ))}
            {!byType.length && (
              <tr>
                <td colSpan={4 + yearCols.length} className="text-sm">
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
            One row per thing installed: <strong>Store code</strong> (or <strong>Store name</strong> and <strong>Chain</strong> until the codes
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
