import Link from "next/link";
import { MultiSelect } from "@/components/MultiSelect";
import { filterOptions, marketName, offTradeQuery, type OffTradeFilters, type StoreView } from "@/lib/off-trade";

/** The off-trade filters, pinned under the header while scrolling. Submits to `action` (GET). */
export function FilterBar({ all, f, shown, action, keep }: { all: StoreView[]; f: OffTradeFilters; shown: number; action: string; keep?: Record<string, string> }) {
  const opts = filterOptions(all);
  const filtered = offTradeQuery(f).length > 0;
  return (
    <form action={action} className="bento sticky top-16 z-20 grid gap-3 !py-4 shadow-md sm:grid-cols-3 lg:grid-cols-7">
      {Object.entries(keep ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <MultiSelect name="market" label="Market" allLabel="All markets" options={opts.market.map((v) => ({ value: v, label: marketName(v) }))} selected={f.market} />
      <MultiSelect name="area" label="Area" allLabel="All areas" options={opts.area.map((v) => ({ value: v, label: v }))} selected={f.area} />
      <MultiSelect name="tmam" label="TM" allLabel="All TMs" options={opts.tmam.map((v) => ({ value: v, label: v }))} selected={f.tmam} />
      <MultiSelect name="segment" label="Segment" allLabel="All segments" options={opts.segment.map((v) => ({ value: v, label: v }))} selected={f.segment} />
      <MultiSelect name="chain" label="Chain" allLabel="All chains" options={opts.chain.map((v) => ({ value: v, label: v }))} selected={f.chain} />
      <MultiSelect name="type" label="Store type" allLabel="All types" options={opts.type.map((v) => ({ value: v, label: v }))} selected={f.type} />
      <div>
        <label className="label" htmlFor="ot-inf">Influence</label>
        <select id="ot-inf" name="influence" defaultValue={f.influence ?? ""} className="field">
          <option value="">All stores</option>
          <option value="yes">Influenced</option>
          <option value="no">Not influenced</option>
        </select>
      </div>
      <div className="flex items-center gap-2 sm:col-span-3 lg:col-span-7">
        <button className="btn btn-primary !px-4 !py-1.5 text-sm">Apply</button>
        {filtered && (
          <Link href={action} className="btn btn-secondary !px-4 !py-1.5 text-sm">
            Reset
          </Link>
        )}
        <span className="ml-auto text-xs">
          {shown} of {all.length} stores
        </span>
      </div>
    </form>
  );
}

/** A dashboard card: the title (and a short summary) shows; click to open. Closed unless `open`. */
export function Card({ title, meta, open, children }: { title: string; meta?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="bento group" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <h2 className="text-xl text-brand-black">{title}</h2>
        <span className="flex items-center gap-2 text-xs">
          {meta}
          <svg viewBox="0 0 20 20" className="h-5 w-5 text-brand-green transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </details>
  );
}

export function Tile({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const body = (
    <>
      <p className="flex items-center justify-between font-display text-xs uppercase tracking-wide">
        {label}
        {href && (
          <span aria-hidden className="text-brand-green">
            →
          </span>
        )}
      </p>
      <p className="mt-1 font-display text-2xl font-medium text-brand-black sm:text-3xl">{value}</p>
      {sub && <p className="text-xs">{sub}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="bento block ring-brand-green transition hover:ring-2">
      {body}
    </Link>
  ) : (
    <div className="bento">{body}</div>
  );
}

/** A single progress bar (achieved of target), with the value written beside it. */
export function Meter({ value, of, wide }: { value: number; of: number; wide?: boolean }) {
  const pct = of ? Math.min(100, Math.round((value / of) * 100)) : 0;
  return (
    <span className={`flex items-center gap-2 ${wide ? "w-full" : "min-w-[9rem]"}`}>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-brand-light" role="img" aria-label={`${pct}% achieved`}>
        <span className="block h-full rounded-full bg-brand-green" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-10 shrink-0 text-right text-xs font-medium text-brand-black">{of ? `${pct}%` : "—"}</span>
    </span>
  );
}
