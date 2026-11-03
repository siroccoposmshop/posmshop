import Link from "next/link";

/** A tool tile on the Commerce Hub home page. */
export function HubTool({
  href,
  title,
  text,
  cta,
  highlight,
  muted,
  stats = [],
  extra,
}: {
  href: string;
  title: string;
  text: string;
  cta: string;
  highlight?: boolean;
  muted?: boolean;
  stats?: { label: string; value: number; red?: boolean }[];
  extra?: React.ReactNode;
}) {
  return (
    <section className={`relative flex min-h-56 flex-col overflow-hidden rounded-[var(--radius-bento)] p-6 ${highlight ? "bg-brand-green text-white" : "bg-white ring-1 ring-black/5"} ${muted ? "opacity-75" : ""}`}>
      {highlight && <div className="absolute inset-y-0 right-0 w-2 bg-brand-red" aria-hidden />}
      <h2 className={`font-display text-3xl font-medium uppercase leading-none ${highlight ? "" : "text-brand-black"}`}>{title}</h2>
      <p className={`mt-2 text-sm ${highlight ? "text-white/90" : ""}`}>{text}</p>
      {stats.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {stats.map((s) => (
            <div key={s.label}>
              <p className={`font-display text-3xl font-bold leading-none ${s.red ? "inline-block rounded-md bg-brand-red px-2" : ""}`}>{s.value}</p>
              <p className={`font-display text-xs uppercase tracking-wide ${highlight ? "text-white/80" : ""}`}>{s.label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
        <Link href={href} className={`btn ${highlight ? "bg-white/15 text-white hover:bg-white/25" : muted ? "btn-secondary" : "btn-primary"}`}>
          {cta} →
        </Link>
        {extra}
      </div>
    </section>
  );
}
