import Link from "next/link";
import { MultiSelect } from "@/components/MultiSelect";
import { TARGET_YEAR, activationByYear, filterOptions, historyYears, marketName, offTradeQuery, type OffTradeFilters, type StoreView } from "@/lib/off-trade";

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

/**
 * The simple picture, for the filters chosen: outlets now, activated each year, activated to date
 * against influenced, and the next year's plan. One scale (today's outlets). Bars aren't outlets.
 */
export function OutletSummary({ stores }: { stores: StoreView[] }) {
  const thisYear = new Date().getFullYear();
  const outlets = stores.filter((s) => !s.bar);
  const total = outlets.length;
  const influenced = outlets.filter((s) => s.influenced).length;
  const toDate = outlets.filter((s) => s.projects.some((p) => p.status === "completed")).length;
  const plan = outlets.filter((s) => s.targeted).length;
  const years = activationByYear(stores, historyYears(stores).filter((y) => y < TARGET_YEAR).slice(0, 3));
  type Row = { label: string; sub?: string; value: number; cls: string; extra?: number; note?: string; gap?: boolean };
  const rows: Row[] = [
    { label: "Outlets now", value: total, cls: "bg-brand-black/25" },
    ...years.map((a, i) => ({
      label: `Activated ${a.year}`,
      sub: a.year === thisYear ? "so far" : undefined,
      value: a.activated,
      cls: ["bg-brand-green-dark", "bg-brand-green", "bg-[#8cc47a]"][i] ?? "bg-brand-green",
      extra: a.year === thisYear ? a.planned : 0,
      note: a.year === thisYear && a.planned ? `+${a.planned} still planned` : undefined,
    })),
    ...(years.length ? [{ label: "Activated to date", sub: "each outlet once", value: toDate, cls: "bg-brand-black/70", gap: true }] : []),
    { label: "Influenced", sub: "visibility in place", value: influenced, cls: "bg-brand-black/40", note: years.length && influenced ? `${toDate} activated to date = ${Math.round((toDate / influenced) * 100)}% of influenced` : undefined },
    { label: `Plan ${TARGET_YEAR}`, sub: "target outlets", value: plan, cls: "bg-brand-red/70", gap: true },
  ];
  const of = (n: number) => (total ? (n / total) * 100 : 0);

  // One thick bar that adds up to all outlets: activated each year (an outlet counts in the first
  // year it was activated), influenced but never activated, and the rest.
  const done = new Set<string>();
  const yearShades = ["bg-brand-green-dark", "bg-brand-green", "bg-[#8cc47a]"];
  const parts: { key: string; label: string; value: number; cls: string; text: string }[] = years.map((a, i) => {
    const ids = outlets.filter((s) => !done.has(s.id) && s.projects.some((p) => p.status === "completed" && (p.completed_date ? Number(p.completed_date.slice(0, 4)) : null) === a.year));
    ids.forEach((s) => done.add(s.id));
    return {
      key: String(a.year),
      label: i === 0 ? `Activated ${a.year}` : `Activated ${a.year}${a.year === thisYear ? " so far" : ""} (new)`,
      value: ids.length,
      cls: yearShades[i] ?? "bg-brand-green",
      text: "text-white",
    };
  });
  const influencedOnly = outlets.filter((s) => s.influenced && !done.has(s.id) && !s.projects.some((p) => p.status === "completed")).length;
  const activatedAny = outlets.filter((s) => done.has(s.id) || s.projects.some((p) => p.status === "completed")).length;
  parts.push({ key: "inf", label: "Influenced, not activated", value: influencedOnly, cls: "bg-brand-black/45", text: "text-white" });
  parts.push({ key: "gap", label: "Not yet reached", value: Math.max(0, total - activatedAny - influencedOnly), cls: "bg-brand-light", text: "text-brand-black" });

  return (
    <section className="bento" aria-label="Outlets: now, activated, influenced and plan">
      <div className="mb-6">
        <p className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-display text-lg uppercase text-brand-black">All {total} outlets</span>
          <span className="text-sm">
            <strong className="text-brand-black">{activatedAny}</strong> activated ({Math.round(of(activatedAny))}%) ·{" "}
            <strong className="text-brand-black">{activatedAny + influencedOnly}</strong> activated or influenced ({Math.round(of(activatedAny + influencedOnly))}%)
          </span>
        </p>
        <div className="flex h-14 overflow-hidden rounded-lg ring-1 ring-black/10" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(", ")}>
          {parts.map((p) =>
            p.value ? (
              <div key={p.key} className={`flex items-center justify-center ${p.cls} ${p.text}`} style={{ width: `${of(p.value)}%` }} title={`${p.label}: ${p.value}`}>
                {of(p.value) >= 6 && <span className="font-display text-sm font-bold sm:text-base">{p.value}</span>}
              </div>
            ) : null,
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {parts.map((p) => (
            <span key={p.key} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded-sm ring-1 ring-black/10 ${p.cls}`} aria-hidden />
              <span className="font-medium text-brand-black">{p.label}</span>
              <span>
                {p.value} · {Math.round(of(p.value))}%
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg uppercase text-brand-black">Outlets at a glance</h2>
        <p className="text-xs">% of the {total} outlets now · bars aren&apos;t counted</p>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className={`grid grid-cols-[7.5rem_1fr] items-center gap-3 sm:grid-cols-[11rem_1fr_9rem] ${r.gap ? "border-t border-black/10 pt-3" : ""}`}>
            <p className="text-sm font-medium leading-tight text-brand-black">
              {r.label}
              {r.sub && <span className="block text-xs font-normal text-brand-grey">{r.sub}</span>}
            </p>
            <div className="flex h-7 overflow-hidden rounded-md bg-brand-light" role="img" aria-label={`${r.label}: ${r.value} of ${total}`}>
              <div className={`h-full ${r.cls}`} style={{ width: `${of(r.value)}%` }} />
              {!!r.extra && <div className="h-full bg-brand-green/35" style={{ width: `${of(r.extra)}%` }} />}
            </div>
            <p className="col-start-2 -mt-2 text-sm sm:col-start-3 sm:mt-0 sm:text-right">
              <strong className="font-display text-lg text-brand-black">{r.value}</strong>
              {r.label !== "Outlets now" && <span className="ml-1.5">{Math.round(of(r.value))}%</span>}
              {r.note && <span className="block text-xs">{r.note}</span>}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
