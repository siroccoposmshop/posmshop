"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UAE_PREFIX, normaliseEmail, normaliseMobile } from "@/lib/contact";
import { MIN_BRIEF_CHARS, PROJECT_TYPES, formatAed, gpCheck, gpPerHlAed, gpWarningText, type ExtraSource, type HubSettings } from "@/lib/hub";
import { OUTLET_TYPES, PICOS_GROUPS, anyNegotiated, otherPromised, picosItemsFor, picosScores, pointsFor, scoringOutletType, type OtherOutletPicos, type Picos } from "@/lib/picos";
import { companyName, outletName } from "@/lib/format";
import type { Investment } from "@/lib/projects";
import { InvestmentNote } from "../_components/InvestmentNote";
import { Spinner } from "@/components/Spinner";
import type { Account, ParentAccount } from "@/lib/types";
import { outletInvestment, submitBrief, type BriefInput } from "../actions";


export type BriefDefaults = Partial<Omit<BriefInput, "accountId">> & { account?: Account | null };

export function BriefForm({ brands, defaults, submitterIsSm, settings }: { brands: string[]; defaults?: BriefDefaults; submitterIsSm: boolean; settings: HubSettings }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(defaults?.account ?? null);
  const [contact, setContact] = useState(defaults?.contact ?? { name: "", mobile: `${UAE_PREFIX} `, email: "" });
  const [projectType, setProjectType] = useState(defaults?.projectType ?? "");
  const [chosenBrands, setChosenBrands] = useState<string[]>(defaults?.brands ?? []);
  const [outletType, setOutletType] = useState(defaults?.outletType ?? scoringOutletType(defaults?.account?.outlet_type) ?? "");
  const [changingType, setChangingType] = useState(false);
  // The outlet type from the outlet's details (Excel / Salesforce), if it maps to a PICOS type.
  const fromOutlet = scoringOutletType(account?.outlet_type);
  const [bif, setBif] = useState(defaults?.budgetBif ? String(defaults.budgetBif) : "");
  const [extra, setExtra] = useState(defaults?.budgetExtra ? String(defaults.budgetExtra) : "");
  const [extraSource, setExtraSource] = useState<ExtraSource | "">(defaults?.budgetExtraSource ?? "");
  const [brief, setBrief] = useState(defaults?.brief ?? "");
  const [volumeBudget, setVolumeBudget] = useState(defaults?.volumeBudget != null ? String(defaults.volumeBudget) : "");
  const [incremental, setIncremental] = useState(defaults?.incrementalVolume != null ? String(defaults.incrementalVolume) : "");
  const [desiredDate, setDesiredDate] = useState(defaults?.desiredDate ?? "");
  const [picos, setPicos] = useState<Picos>(defaults?.picos ?? { items: {}, notes: {} });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Earlier investment in the chosen outlet, and the other outlets under the same customer (for PICOS).
  const [investment, setInvestment] = useState<Investment | null>(null);
  const [siblings, setSiblings] = useState<Account[] | null>(null);
  useEffect(() => {
    setInvestment(null);
    setSiblings(null);
    if (!account) return;
    let live = true;
    outletInvestment(account.id, defaults?.projectId).then((inv) => live && setInvestment(inv));
    createClient()
      .from("accounts")
      .select("*")
      .eq("parent_number", account.parent_number)
      .eq("active", true)
      .neq("id", account.id)
      .order("name")
      .then(({ data }) => live && setSiblings((data as Account[]) ?? []));
    return () => {
      live = false;
    };
  }, [account, defaults?.projectId]);

  const bifNum = Number(bif.replace(/[^0-9.]/g, "")) || 0;
  const extraNum = Number(extra.replace(/[^0-9.]/g, "")) || 0;
  const budgetNum = bifNum + extraNum;
  const gp = gpCheck(budgetNum, incremental === "" ? null : Number(incremental), settings);
  const scores = useMemo(() => picosScores(outletType, picos), [outletType, picos]);
  const approval =
    budgetNum >= settings.cmApprovalAed
      ? submitterIsSm
        ? "CM/TMM will approve this before Trade Marketing."
        : "Your Sales Manager, then CM/TMM, will approve this before Trade Marketing."
      : budgetNum >= settings.smApprovalAed && !submitterIsSm
        ? "Your Sales Manager will approve this before Trade Marketing."
        : budgetNum > 0
          ? "Goes straight to Trade Marketing."
          : "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    // Quick checks here; the server checks everything again.
    const errs: Record<string, string> = {};
    if (!account) errs.account = "Choose the customer and outlet.";
    if (!contact.name.trim()) errs.contactName = "Enter the contact's name.";
    const m = normaliseMobile(contact.mobile);
    if (!m.ok) errs.contactMobile = m.error;
    const em = normaliseEmail(contact.email);
    if (!em.ok) errs.contactEmail = em.error;
    if (!projectType) errs.projectType = "Choose the project type.";
    if (!chosenBrands.length) errs.brands = "Choose at least one brand.";
    if (!outletType) errs.outletType = "Choose the outlet type.";
    if (!(bifNum > 0)) errs.budget = "Enter the BIF value in AED.";
    if (extraNum > 0 && !extraSource) errs.budgetExtra = "Choose Sirocco or Other for the extra funding.";
    if (brief.trim().length < MIN_BRIEF_CHARS) errs.brief = `Describe the project in at least ${MIN_BRIEF_CHARS} characters.`;
    if (volumeBudget === "") errs.volumeBudget = "Enter the 2027 volume budget in HL.";
    if (incremental === "") errs.incrementalVolume = "Enter the incremental volume in HL.";
    if (!desiredDate) errs.desiredDate = "Choose the desired execution date.";
    if (outletType && !anyNegotiated(outletType, picos)) {
      errs.picos = "Tick at least one PICOS change negotiated in this deal (at this outlet or another one).";
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError("Please complete the highlighted sections.");
      document.querySelector(`[data-section="${Object.keys(errs)[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    start(async () => {
      const res = await submitBrief({
        projectId: defaults?.projectId,
        accountId: account!.id,
        projectType,
        brands: chosenBrands,
        outletType,
        contact: { name: contact.name, mobile: m.ok ? m.value : contact.mobile, email: em.ok ? em.value : contact.email },
        budgetBif: bifNum,
        budgetExtra: extraNum > 0 ? extraNum : null,
        budgetExtraSource: extraNum > 0 && extraSource ? extraSource : null,
        brief,
        volumeBudget: Number(volumeBudget),
        incrementalVolume: Number(incremental),
        desiredDate,
        picos,
      });
      if (res.error) {
        setFormError(res.error);
        if (res.fieldErrors) setErrors(res.fieldErrors);
        return;
      }
      router.push(`/projects/${res.id}?submitted=1`);
    });
  }

  const err = (k: string) => (errors[k] ? <p className="mt-1 text-xs text-brand-red">{errors[k]}</p> : null);

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-4">
      <Section n={1} title="Customer & outlet" id="account" error={errors.account}>
        <OutletPicker
          account={account}
          onChange={(a) => {
            setAccount(a);
            setErrors((e) => ({ ...e, account: "" }));
            const mapped = scoringOutletType(a?.outlet_type);
            if (mapped) {
              setOutletType(mapped);
              setChangingType(false);
            }
          }}
        />
        {account && investment && (
          <div className="mt-3">
            <InvestmentNote investment={investment} company={companyName(account.parent_name || account.name)} you />
          </div>
        )}
        {err("account")}
      </Section>

      {account && (
        <Section n={2} title="Main customer contact" id="contactName">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="b-cname">Name</label>
              <input id="b-cname" className="field" autoComplete="off" data-1p-ignore data-lpignore="true" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
              {err("contactName")}
            </div>
            <div>
              <label className="label" htmlFor="b-cmobile">Mobile</label>
              <input
                id="b-cmobile"
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
            <div>
              <label className="label" htmlFor="b-cemail">Email</label>
              <input id="b-cemail" className="field" type="email" inputMode="email" autoComplete="off" data-1p-ignore data-lpignore="true" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
              {err("contactEmail")}
            </div>
          </div>
        </Section>
      )}

      <Section n={3} title="Project" id="projectType">
        <div className="space-y-4">
          <div>
            <p className="label">Project type</p>
            <Chips options={PROJECT_TYPES as readonly string[]} value={projectType ? [projectType] : []} onToggle={(v) => setProjectType(v)} />
            {err("projectType")}
          </div>
          <div data-section="brands">
            <p className="label">Brands</p>
            <Chips
              options={brands}
              value={chosenBrands}
              onToggle={(v) => setChosenBrands((b) => (b.includes(v) ? b.filter((x) => x !== v) : [...b, v]))}
            />
            {err("brands")}
          </div>
          <div data-section="outletType">
            <p className="label">Outlet type</p>
            {fromOutlet && !changingType ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-brand-green px-3.5 py-1.5 font-display text-sm font-medium uppercase tracking-wide text-white">✓ {outletType}</span>
                <span className="text-xs">
                  From the outlet details{account?.outlet_type && account.outlet_type !== outletType ? ` (“${account.outlet_type}”)` : ""}.{" "}
                  <button type="button" className="underline" onClick={() => setChangingType(true)}>
                    Change
                  </button>
                </span>
              </div>
            ) : (
              <>
                <Chips options={OUTLET_TYPES as readonly string[]} value={outletType ? [outletType] : []} onToggle={(v) => setOutletType(v)} />
                <p className="mt-1 text-xs">
                  {account && !fromOutlet ? "Not in the outlet details yet, so choose one. " : ""}Sets which PICOS items count and how many points each is worth.
                </p>
              </>
            )}
            {err("outletType")}
          </div>
        </div>
      </Section>

      <Section n={4} title="Budget & volume" id="budget">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="b-budget">BIF value (AED)</label>
            <input id="b-budget" className="field" inputMode="decimal" placeholder="e.g. 25000" value={bif} onChange={(e) => setBif(e.target.value)} />
            {err("budget")}
          </div>
          <div data-section="budgetExtra">
            <div className="flex items-end justify-between gap-2">
              <label className="label whitespace-nowrap" htmlFor="b-extra">
                Extra funding
              </label>
              <div className="mb-1 flex shrink-0 overflow-hidden rounded-full ring-1 ring-black/15" role="group" aria-label="Extra funding from">
                {(["sirocco", "other"] as const).map((src) => (
                  <button
                    key={src}
                    type="button"
                    aria-pressed={extraSource === src}
                    onClick={() => setExtraSource(extraSource === src ? "" : src)}
                    className={`px-2 py-0.5 font-display text-[0.65rem] uppercase tracking-wide transition ${
                      extraSource === src ? "bg-brand-green text-white" : "bg-white text-brand-grey hover:text-brand-black"
                    }`}
                  >
                    {src === "sirocco" ? "Sirocco" : "Other"}
                  </button>
                ))}
              </div>
            </div>
            <input id="b-extra" className="field" inputMode="decimal" placeholder="AED · optional" value={extra} onChange={(e) => setExtra(e.target.value)} />
            {err("budgetExtra")}
          </div>
          <div>
            <p className="label">Total budget</p>
            <p className="field flex items-center !bg-brand-light font-medium text-brand-black" aria-live="polite">
              {budgetNum > 0 ? formatAed(budgetNum) : "—"}
            </p>
          </div>
          <div data-section="volumeBudget">
            <label className="label" htmlFor="b-vol">Volume budget 2027 (HL)</label>
            <input id="b-vol" className="field" inputMode="decimal" value={volumeBudget} onChange={(e) => setVolumeBudget(e.target.value.replace(/[^0-9.]/g, ""))} />
            {err("volumeBudget")}
          </div>
          <div data-section="incrementalVolume">
            <label className="label" htmlFor="b-inc">Incremental vs budget (HL)</label>
            <input id="b-inc" className="field" inputMode="decimal" value={incremental} onChange={(e) => setIncremental(e.target.value.replace(/[^0-9.]/g, ""))} />
            {err("incrementalVolume")}
          </div>
          <div>
            <p className="label">Est. GP from uplift</p>
            <p className="field flex items-center !bg-brand-light text-brand-black" title={`USD ${settings.gpPerHlUsd} (AED ${gpPerHlAed(settings).toFixed(2)}) per incremental HL`}>
              {incremental !== "" ? formatAed(gp?.gp ?? Number(incremental) * gpPerHlAed(settings)) : "—"}
            </p>
          </div>
        </div>
        {approval && (
          <p className="mt-3 rounded-lg bg-brand-light px-3 py-2 text-xs">
            <strong className="text-brand-black">{formatAed(budgetNum)}</strong>
            {extraNum > 0 && extraSource === "sirocco" && <> (incl. {formatAed(extraNum)} Sirocco)</>} · {approval}
            {extraNum > 0 && extraSource === "sirocco" && " The Sirocco funding will be shown to the approvers."}
          </p>
        )}
        {gp && gp.level !== "ok" && (
          <div className="mt-2 rounded-lg bg-brand-red px-3 py-2 text-white" role="alert">
            <p className="font-display text-sm font-bold uppercase tracking-wide">
              Warning: This investment looks to be GP {gp.level}
            </p>
            <p className="text-xs text-white/90">{gpWarningText(gp, settings)}</p>
          </div>
        )}
      </Section>

      <Section n={5} title="Brief" id="brief">
        <textarea
          className="field min-h-36"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="What should be done, where in the outlet, why it matters, and anything Trade Marketing should know (sizes, deadlines, customer requests)."
        />
        <p className={`mt-1 text-xs ${brief.trim().length < MIN_BRIEF_CHARS ? "" : "text-brand-green"}`}>
          {brief.trim().length < MIN_BRIEF_CHARS ? `${MIN_BRIEF_CHARS - brief.trim().length} more characters needed` : "✓ Enough detail"}
        </p>
        {err("brief")}
      </Section>

      <Section n={6} title="PICOS" id="picos">
        {!outletType ? (
          <p className="text-sm">Choose the outlet type in section 3 first.</p>
        ) : (
          <div className="space-y-4">
            {!!siblings?.length && account && (
              <p className="font-display text-sm font-medium uppercase tracking-wide text-brand-black">{outletName(account.name)}</p>
            )}
            <PicosChecklist outletType={outletType} picos={picos} onChange={setPicos} scores={scores} />
            {!!siblings?.length && (
              <div className="space-y-2 border-t border-black/10 pt-4">
                <div>
                  <p className="font-display text-sm font-medium uppercase tracking-wide text-brand-black">
                    Other outlets at {companyName(account?.parent_name || account?.name)}
                  </p>
                  <p className="text-xs">
                    If this deal also improves PICOS elsewhere in the group, open the outlet and tick what&apos;s in place and what&apos;s
                    negotiated there.
                  </p>
                </div>
                {siblings.map((o) => (
                  <OtherOutletCard
                    key={o.id}
                    outlet={o}
                    value={picos.others?.[o.id]}
                    onChange={(v) =>
                      setPicos((p) => {
                        const others = { ...(p.others ?? {}) };
                        if (v) others[o.id] = v;
                        else delete others[o.id];
                        return { ...p, others };
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
        {err("picos")}
      </Section>

      <Section n={7} title="Desired execution date" id="desiredDate">
        <input
          type="date"
          className="field !w-auto"
          value={desiredDate}
          min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
          onChange={(e) => setDesiredDate(e.target.value)}
        />
        {err("desiredDate")}
      </Section>

      <div className="bento flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-sm ${formError ? "text-brand-red" : ""}`}>{formError ?? "Every section is required. Trade Marketing will be in touch once it's reviewed."}</p>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? (
            <>
              <Spinner /> Submitting…
            </>
          ) : defaults?.projectId ? (
            "Resubmit request"
          ) : (
            "Submit request"
          )}
        </button>
      </div>
    </form>
  );
}

function Section({ n, title, id, error, children }: { n: number; title: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <section data-section={id} className={`bento scroll-mt-24 ${error ? "ring-2 ring-brand-red/60" : ""}`}>
      <h2 className="mb-3 flex items-center gap-2 text-xl text-brand-black">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-green font-display text-sm text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Chips({ options, value, onToggle }: { options: readonly string[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o)}
            className={`rounded-full px-3.5 py-1.5 font-display text-sm font-medium uppercase tracking-wide ring-1 transition-colors ${
              on ? "bg-brand-green text-white ring-brand-green" : "bg-white text-brand-grey ring-black/15 hover:ring-brand-green"
            }`}
          >
            {on ? "✓ " : ""}
            {o}
          </button>
        );
      })}
    </div>
  );
}

function PicosChecklist({
  outletType,
  picos,
  onChange,
  scores,
  showNotes = true,
}: {
  outletType: string;
  picos: Picos;
  onChange: (p: Picos) => void;
  scores: { current: number; promised: number };
  showNotes?: boolean;
}) {
  const items = picosItemsFor(outletType);
  const set = (key: string, field: "current" | "promised", v: boolean) => {
    const prev = picos.items[key] ?? {};
    const next = { ...prev, [field]: v, ...(field === "current" && v ? { promised: false } : {}) };
    onChange({ ...picos, items: { ...picos.items, [key]: next } });
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <ScoreTile label="PICOS score now" value={scores.current} />
        <ScoreTile label="After this deal" value={scores.promised} highlight={scores.promised > scores.current} />
      </div>
      <p className="text-xs">
        For a <strong>{outletType}</strong>. Tick <strong>In place</strong> for what the outlet has today and <strong>Negotiated</strong> for
        what this deal adds.
      </p>
      {PICOS_GROUPS.map((g) => {
        const rows = items.filter((i) => i.group === g);
        if (!rows.length) return null;
        const noteKey = g.toLowerCase() as keyof Picos["notes"];
        return (
          <div key={g}>
            <div className="flex items-end justify-between border-b-2 border-brand-green pb-1">
              <h3 className="font-display text-sm font-medium uppercase tracking-wide text-brand-black">{g}</h3>
              <div className="flex gap-3 font-display text-[0.65rem] uppercase tracking-wide sm:gap-6">
                <span className="w-14 text-center">In place</span>
                <span className="w-16 text-center">Negotiated</span>
              </div>
            </div>
            <ul className="divide-y divide-black/5">
              {rows.map((i) => {
                const s = picos.items[i.key] ?? {};
                return (
                  <li key={i.key} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm text-brand-black">
                      {i.label} <span className="text-xs text-brand-grey">· {pointsFor(i.key, outletType)} pts</span>
                    </span>
                    <span className="flex shrink-0 gap-3 sm:gap-6">
                      <span className="flex w-14 justify-center">
                        <input type="checkbox" aria-label={`${i.label} in place`} className="h-5 w-5 accent-[var(--color-brand-grey)]" checked={!!s.current} onChange={(e) => set(i.key, "current", e.target.checked)} />
                      </span>
                      <span className="flex w-16 justify-center">
                        <input
                          type="checkbox"
                          aria-label={`${i.label} negotiated`}
                          className="h-5 w-5 accent-[var(--color-brand-green)] disabled:opacity-30"
                          disabled={!!s.current}
                          checked={!!s.promised && !s.current}
                          onChange={(e) => set(i.key, "promised", e.target.checked)}
                        />
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {showNotes && (<input
              className="field mt-2 !py-2 text-sm"
              placeholder={g === "Availability" ? "Details, e.g. new listing: Birra Moretti draught" : `${g} details (optional)`}
              value={picos.notes[noteKey] ?? ""}
              onChange={(e) => onChange({ ...picos, notes: { ...picos.notes, [noteKey]: e.target.value } })}
            />)}
          </div>
        );
      })}
    </div>
  );
}

/** Another outlet under the customer: collapsed, with its own outlet type and PICOS ticks. */
function OtherOutletCard({ outlet, value, onChange }: { outlet: Account; value?: OtherOutletPicos; onChange: (v: OtherOutletPicos | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const type = value?.outlet_type || scoringOutletType(outlet.outlet_type) || "";
  const items = value?.items ?? {};
  const scores = type ? picosScores(type, { items, notes: {} }) : null;
  const negotiated = value && type ? otherPromised({ ...value, outlet_type: type }).length : 0;
  const update = (outlet_type: string, next: OtherOutletPicos["items"]) =>
    onChange(outlet_type || Object.keys(next).length ? { account_number: outlet.account_number, name: outlet.name, outlet_type, items: next } : undefined);

  return (
    <div className={`rounded-xl ring-1 ${negotiated ? "ring-brand-green" : "ring-black/10"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
        <span className="min-w-0">
          <span className="block truncate font-medium text-brand-black">{outletName(outlet.name)}</span>
          <span className="text-xs">
            #{outlet.account_number}
            {type ? ` · ${type}` : " · outlet type not set"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {negotiated > 0 && <span className="badge bg-brand-green text-white">{negotiated} negotiated</span>}
          {scores && (scores.current > 0 || scores.promised > 0) && (
            <span className="font-display text-sm font-bold text-brand-black">
              {scores.current}% <span className="text-brand-grey">→</span> <span className="text-brand-green">{scores.promised}%</span>
            </span>
          )}
          <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-black/5 px-3 pb-3 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="label !mb-0" htmlFor={`ot-${outlet.id}`}>Outlet type</label>
            <select id={`ot-${outlet.id}`} className="field !w-auto !py-1.5 text-sm" value={type} onChange={(e) => update(e.target.value, items)}>
              <option value="">Choose…</option>
              {OUTLET_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          {type ? (
            <PicosChecklist outletType={type} picos={{ items, notes: {} }} onChange={(p) => update(type, p.items)} scores={scores!} showNotes={false} />
          ) : (
            <p className="text-sm">Choose the outlet type to score it.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreTile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-brand-green text-white" : "bg-brand-light"}`}>
      <p className={`font-display text-xs uppercase tracking-wide ${highlight ? "text-white/85" : ""}`}>{label}</p>
      <p className={`font-display text-4xl font-bold ${highlight ? "" : "text-brand-black"}`}>{value}%</p>
    </div>
  );
}

/** Parent account search → outlet, as in POSM Shop. The contact isn't pre-filled (until it comes from Salesforce). */
function OutletPicker({ account, onChange }: { account: Account | null; onChange: (a: Account | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParentAccount[]>([]);
  const [parent, setParent] = useState<ParentAccount | null>(null);
  const [outlets, setOutlets] = useState<Account[] | null>(null);
  const [outletError, setOutletError] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < 2) return setResults([]);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      const safe = q.replace(/[%,()]/g, " ");
      const { data } = await createClient()
        .from("parent_accounts")
        .select("*")
        .or(`parent_name.ilike.%${safe}%,parent_number.ilike.%${safe}%`)
        .order("parent_name")
        .limit(25);
      setResults((data as ParentAccount[]) ?? []);
      setSearching(false);
    }, 250);
  }, [query]);

  useEffect(() => {
    if (!parent) return setOutlets(null);
    setOutletError(false);
    // "*" so the list still loads before newer columns (e.g. outlet_type) exist in the database.
    createClient()
      .from("accounts")
      .select("*")
      .eq("parent_number", parent.parent_number)
      .eq("parent_name", parent.parent_name)
      .eq("active", true)
      .order("name")
      .then(({ data, error }) => {
        if (error) console.error("Loading outlets failed", error);
        setOutletError(!!error);
        setOutlets((data as Account[]) ?? []);
      });
  }, [parent]);

  if (account) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-green p-4 text-white">
        <div>
          <p className="font-display text-sm uppercase leading-tight text-white/85">{account.parent_name}</p>
          <p className="font-display text-lg font-medium uppercase leading-tight">{account.name}</p>
          <p className="text-sm text-white/85">Outlet #{account.account_number}</p>
        </div>
        <button
          type="button"
          className="btn bg-white/15 text-white hover:bg-white/25"
          onClick={() => {
            onChange(null);
            setParent(null);
            setQuery("");
          }}
        >
          Change
        </button>
      </div>
    );
  }

  if (parent) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-brand-light px-3 py-2">
          <span className="text-sm">
            <strong className="text-brand-black">{parent.parent_name}</strong> · #{parent.parent_number}
          </span>
          <button type="button" className="text-sm underline" onClick={() => setParent(null)}>
            Change
          </button>
        </div>
        <p className="label">Outlet</p>
        {outlets === null ? (
          <p className="text-sm">Loading outlets…</p>
        ) : outletError ? (
          <p className="text-sm text-brand-red">Couldn&apos;t load the outlets. Reload the page and try again.</p>
        ) : outlets.length === 0 ? (
          <p className="text-sm">No open outlets under this customer.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {outlets.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => onChange(o)} className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left hover:bg-brand-green-tint">
                  <span>
                    <span className="block font-medium text-brand-black">{o.name}</span>
                    <span className="text-xs">#{o.account_number}</span>
                  </span>
                  <span className="text-brand-green" aria-hidden>
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className="label" htmlFor="b-search">
        Search customer (parent account) name or number
      </label>
      <input id="b-search" type="search" className="field" placeholder="e.g. 25 Hours Hotel or 53248" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      <ul className="mt-2 divide-y divide-black/5">
        {searching && <li className="py-2 text-sm">Searching…</li>}
        {!searching && query.trim().length >= 2 && !results.length && <li className="py-2 text-sm">No customers match “{query}”.</li>}
        {results.map((p) => (
          <li key={`${p.parent_number}-${p.parent_name}`}>
            <button type="button" onClick={() => setParent(p)} className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left hover:bg-brand-green-tint">
              <span>
                <span className="block font-medium text-brand-black">{p.parent_name}</span>
                <span className="text-xs">
                  #{p.parent_number} · {p.outlet_count} {p.outlet_count === 1 ? "outlet" : "outlets"}
                </span>
              </span>
              <span className="badge bg-brand-light">{p.market}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
