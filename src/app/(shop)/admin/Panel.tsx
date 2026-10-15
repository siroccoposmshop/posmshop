const TONES = {
  neutral: "bg-brand-light text-brand-black",
  red: "bg-brand-red text-white",
  amber: "bg-amber-500 text-white",
};

/** Collapsed card: the title and a count, with the detail shown when opened. */
export function Panel({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <details className="bento group !p-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <h2 className="text-xl text-brand-black">{title}</h2>
          <span className={`badge ${count ? TONES[tone] : TONES.neutral}`}>{count}</span>
        </span>
        <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden>
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="overflow-x-auto border-t border-black/5 px-5 pb-5 pt-3">{children}</div>
    </details>
  );
}
