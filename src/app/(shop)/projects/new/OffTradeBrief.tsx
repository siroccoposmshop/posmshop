"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UAE_PREFIX, normaliseEmail, normaliseMobile } from "@/lib/contact";
import { MIN_BRIEF_CHARS, formatAed } from "@/lib/hub";
import { formatDate } from "@/lib/format";
import { addWorkingDays, planStages, todayIso, workingDaysBetween } from "@/lib/working-days";
import type { StageType } from "@/lib/projects";
import { Spinner } from "@/components/Spinner";
import { submitOffTradeProject, type OffTradeStoreSummary } from "../actions";

const TYPES = ["Branding", "Perfect shelf", "Cold room", "Fridge", "FSU", "Takeover", "Other"];

/** The store at a glance: influence, what's installed and when, what's planned or running. */
export function StoreSummary({ s }: { s: OffTradeStoreSummary }) {
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-brand-light p-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <span className={`badge ${s.influenced ? "bg-brand-green text-white" : "bg-white text-brand-grey"}`}>{s.influenced ? "Influenced" : "Not influenced"}</span>
        {s.executedYears.length > 0 && <span className="badge bg-white text-brand-black">Executed {s.executedYears.join(", ")}</span>}
        {s.coldRoom && (
          <span className={`badge ${s.coldRoomActivated ? "bg-brand-green-tint text-brand-green-dark" : "bg-white text-brand-black"}`}>
            Cold room{s.coldRoomActivated ? ` · activated ${formatDate(s.coldRoomActivated)}` : " · not activated"}
          </span>
        )}
        {s.segment && <span className="badge bg-white text-brand-black">{s.segment}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="font-display text-xs uppercase tracking-wide">Visibility in place</p>
          <p className="text-brand-black">{s.visibility.length ? s.visibility.map((v) => `${v.title}${v.qty > 1 ? ` ×${v.qty}` : ""}`).join(" · ") : "None recorded"}</p>
        </div>
        <div>
          <p className="font-display text-xs uppercase tracking-wide">Installed (latest)</p>
          {s.done.length ? (
            <ul className="text-brand-black">
              {s.done.slice(0, 4).map((d, i) => (
                <li key={i}>
                  {d.type}
                  {d.item && d.item !== d.type ? ` (${d.item})` : ""}
                  {d.qty > 1 ? ` ×${d.qty}` : ""} <span className="text-xs text-brand-grey">· {d.date ? formatDate(d.date) : "—"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-brand-black">Nothing recorded yet</p>
          )}
        </div>
      </div>
      {(s.planned.length > 0 || s.openProjects.length > 0) && (
        <div className="border-t border-black/10 pt-2">
          <p className="font-display text-xs uppercase tracking-wide">Already planned or running</p>
          <ul className="text-brand-black">
            {s.openProjects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="underline">
                  {p.ref} · {p.title}
                </Link>
              </li>
            ))}
            {s.planned
              .filter((x) => !s.openProjects.length || x.status !== "in_progress")
              .map((p, i) => (
                <li key={i}>
                  {p.type} <span className="text-xs text-brand-grey">· {p.status === "in_progress" ? "locked in" : "planned"}{p.date ? ` ${formatDate(p.date)}` : ""}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function OffTradeBrief({ storeId, brands, stageTypes, Section, Chips }: {
  storeId: string;
  brands: string[];
  stageTypes: StageType[];
  Section: (p: { n: number; title: string; id: string; error?: string; children: React.ReactNode }) => React.ReactNode;
  Chips: (p: { options: readonly string[]; value: string[]; onToggle: (v: string) => void }) => React.ReactNode;
}) {
  const router = useRouter();
  const [contact, setContact] = useState({ name: "", mobile: `${UAE_PREFIX} `, email: "" });
  const [type, setType] = useState("");
  const [chosenBrands, setBrands] = useState<string[]>([]);
  const [cost, setCost] = useState("");
  const [brief, setBrief] = useState("");
  const [notes, setNotes] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [days, setDays] = useState<Record<string, number>>(() => Object.fromEntries(stageTypes.map((t) => [t.key, t.default_days])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const today = todayIso();
  const chosen = stageTypes.filter((t) => days[t.key] !== undefined).map((t) => ({ ...t, days: days[t.key] }));
  const plan = planStages(today, chosen);
  const end = plan.at(-1)?.due_date ?? today;
  const slack = targetDate ? workingDaysBetween(end, targetDate) : null;
  const costNum = Number(cost.replace(/[^0-9.]/g, "")) || 0;
  const err = (k: string) => (errors[k] ? <p className="mt-1 text-xs text-brand-red">{errors[k]}</p> : null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const errs: Record<string, string> = {};
    if (!contact.name.trim()) errs.contactName = "Enter the contact's name.";
    const m = normaliseMobile(contact.mobile);
    if (!m.ok) errs.contactMobile = m.error;
    const em = contact.email.trim() ? normaliseEmail(contact.email) : ({ ok: true, value: "" } as const);
    if (!em.ok) errs.contactEmail = em.error;
    if (!type) errs.projectType = "Choose the project type.";
    if (!chosenBrands.length) errs.brands = "Choose at least one brand.";
    if (!(costNum > 0)) errs.cost = "Enter the estimated cost in AED.";
    if (brief.trim().length < MIN_BRIEF_CHARS) errs.brief = `Describe the project in at least ${MIN_BRIEF_CHARS} characters.`;
    if (!targetDate) errs.targetDate = "Choose the target date.";
    if (!chosen.length) errs.stages = "Choose at least one stage.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError("Please complete the highlighted sections.");
      document.querySelector(`[data-section="${Object.keys(errs)[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    start(async () => {
      const res = await submitOffTradeProject({
        storeId,
        contact: { name: contact.name, mobile: m.ok ? m.value : contact.mobile, email: em.ok ? em.value : contact.email },
        projectType: type,
        brands: chosenBrands,
        estimatedCost: costNum,
        brief,
        notes,
        targetDate,
        stages: chosen.map((c) => ({ key: c.key, days: c.days })),
      });
      if (res.error) {
        setFormError(res.error);
        if (res.fieldErrors) setErrors(res.fieldErrors);
        return;
      }
      router.push(`/projects/${res.id}?started=1`);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Section n={2} title="Customer contact" id="contactName">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="o-cname">Name</label>
            <input id="o-cname" className="field" autoComplete="off" data-1p-ignore data-lpignore="true" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
            {err("contactName")}
          </div>
          <div data-section="contactMobile">
            <label className="label" htmlFor="o-cmobile">Mobile</label>
            <input
              id="o-cmobile"
              className="field"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              value={contact.mobile}
              onChange={(e) => setContact({ ...contact, mobile: e.target.value })}
              onBlur={() => {
                const m = normaliseMobile(contact.mobile);
                if (m.ok) setContact((c) => ({ ...c, mobile: m.value }));
              }}
            />
            {err("contactMobile")}
          </div>
          <div data-section="contactEmail">
            <label className="label" htmlFor="o-cemail">Email <span className="normal-case tracking-normal text-brand-grey">· optional</span></label>
            <input id="o-cemail" className="field" type="email" inputMode="email" autoComplete="off" data-1p-ignore data-lpignore="true" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
            {err("contactEmail")}
          </div>
        </div>
      </Section>

      <Section n={3} title="Project" id="projectType">
        <div className="space-y-4">
          <div>
            <p className="label">Type</p>
            <Chips options={TYPES} value={type ? [type] : []} onToggle={(v) => setType(v)} />
            {err("projectType")}
          </div>
          <div data-section="brands">
            <p className="label">Brands</p>
            <Chips options={brands} value={chosenBrands} onToggle={(v) => setBrands((b) => (b.includes(v) ? b.filter((x) => x !== v) : [...b, v]))} />
            {err("brands")}
          </div>
          <div data-section="cost" className="max-w-xs">
            <label className="label" htmlFor="o-cost">Estimated cost (AED)</label>
            <input id="o-cost" className="field" inputMode="decimal" placeholder="e.g. 12000" value={cost} onChange={(e) => setCost(e.target.value)} />
            {costNum > 0 && <p className="mt-1 text-xs">{formatAed(costNum)}</p>}
            {err("cost")}
          </div>
        </div>
      </Section>

      <Section n={4} title="Brief" id="brief">
        <textarea
          className="field min-h-36"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="What will be done, where in the store, sizes, and anything the team should know."
        />
        <p className={`mt-1 text-xs ${brief.trim().length < MIN_BRIEF_CHARS ? "" : "text-brand-green"}`}>
          {brief.trim().length < MIN_BRIEF_CHARS ? `${MIN_BRIEF_CHARS - brief.trim().length} more characters needed` : "✓ Enough detail"}
        </p>
        {err("brief")}
        <label className="label mt-4 block" htmlFor="o-notes">
          Notes <span className="normal-case tracking-normal text-brand-grey">· optional</span>
        </label>
        <textarea id="o-notes" className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access times, contacts on site, anything else." />
      </Section>

      <Section n={5} title="Target date" id="targetDate">
        <input type="date" className="field !w-auto" value={targetDate} min={addWorkingDays(today, 1)} onChange={(e) => setTargetDate(e.target.value)} />
        {err("targetDate")}
      </Section>

      <Section n={6} title="Stages" id="stages">
        <p className="mb-3 text-sm">Untick a stage that isn&apos;t needed and adjust the working days. The project starts today with the first stage.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {stageTypes.map((t, i) => {
            const on = days[t.key] !== undefined;
            return (
              <div key={t.key} className={`flex items-center gap-2 rounded-xl p-2 pr-3 ring-1 ${on ? "bg-brand-green-tint ring-brand-green" : "bg-white ring-black/10"}`}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setDays((d) => {
                      const next = { ...d };
                      if (on) delete next[t.key];
                      else next[t.key] = t.default_days;
                      return next;
                    })
                  }
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm ${on ? "bg-brand-green text-white" : "bg-brand-light text-brand-grey"}`}
                  aria-label={`${on ? "Remove" : "Add"} ${t.name}`}
                >
                  {on ? "✓" : i + 1}
                </button>
                <span className={`min-w-0 flex-1 font-display text-sm font-medium uppercase leading-tight ${on ? "text-brand-black" : "text-brand-grey"}`}>{t.name}</span>
                {on && (
                  <label className="flex shrink-0 items-center gap-1 text-xs">
                    <input
                      type="number"
                      min={1}
                      max={250}
                      value={days[t.key]}
                      onChange={(e) => setDays((d) => ({ ...d, [t.key]: Math.max(1, Math.min(250, Number(e.target.value) || 1)) }))}
                      className="field !w-14 !px-2 !py-1 text-center text-sm"
                      aria-label={`${t.name} working days`}
                    />
                    d
                  </label>
                )}
              </div>
            );
          })}
        </div>
        {chosen.length > 0 && (
          <div className="mt-3 rounded-xl bg-brand-light p-3 text-sm">
            <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
              {plan.map((s, i) => (
                <li key={s.key} className="flex items-center gap-1">
                  <span className="rounded-full bg-white px-2 py-1 text-brand-black">
                    {s.name} <span className="text-brand-grey">· {formatDate(s.due_date)}</span>
                  </span>
                  {i < plan.length - 1 && <span aria-hidden>→</span>}
                </li>
              ))}
            </ol>
            <p className={`mt-3 font-medium ${slack === null || slack >= 0 ? "text-brand-green-dark" : "text-brand-red"}`}>
              Expected completion {formatDate(end)}
              {slack === null ? "." : slack >= 0 ? `, on time for the target ${formatDate(targetDate)}.` : `, ${-slack} working days after the target ${formatDate(targetDate)}.`}
            </p>
          </div>
        )}
        {err("stages")}
      </Section>

      <div className="bento flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-sm ${formError ? "text-brand-red" : ""}`}>{formError ?? "Off-trade projects start straight away; no approval needed."}</p>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? (
            <>
              <Spinner /> Creating…
            </>
          ) : (
            "Create project"
          )}
        </button>
      </div>
    </form>
  );
}
