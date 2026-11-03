"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UAE_PREFIX, normaliseEmail, normaliseMobile } from "@/lib/contact";
import { CM_APPROVAL_AED, MIN_BRIEF_CHARS, PROJECT_TYPES, SM_APPROVAL_AED, formatAed } from "@/lib/hub";
import { OUTLET_TYPES, PICOS_GROUPS, picosItemsFor, picosScores, pointsFor, type Picos } from "@/lib/picos";
import { Spinner } from "@/components/Spinner";
import type { Account, Contact, ParentAccount } from "@/lib/types";
import { submitBrief, type BriefInput } from "../actions";

const ACCOUNT_FIELDS = "id, account_number, name, parent_number, parent_name, kam_name, market, channel";

export type BriefDefaults = Partial<Omit<BriefInput, "accountId">> & { account?: Account | null };

export function BriefForm({ brands, defaults, submitterIsSm }: { brands: string[]; defaults?: BriefDefaults; submitterIsSm: boolean }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(defaults?.account ?? null);
  const [contact, setContact] = useState(defaults?.contact ?? { name: "", mobile: `${UAE_PREFIX} `, email: "" });
  const [projectType, setProjectType] = useState(defaults?.projectType ?? "");
  const [chosenBrands, setChosenBrands] = useState<string[]>(defaults?.brands ?? []);
  const [outletType, setOutletType] = useState(defaults?.outletType ?? "");
  const [budget, setBudget] = useState(defaults?.budget ? String(defaults.budget) : "");
  const [brief, setBrief] = useState(defaults?.brief ?? "");
  const [volumeBudget, setVolumeBudget] = useState(defaults?.volumeBudget != null ? String(defaults.volumeBudget) : "");
  const [incremental, setIncremental] = useState(defaults?.incrementalVolume != null ? String(defaults.incrementalVolume) : "");
  const [desiredDate, setDesiredDate] = useState(defaults?.desiredDate ?? "");
  const [picos, setPicos] = useState<Picos>(defaults?.picos ?? { items: {}, notes: {} });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const budgetNum = Number(budget.replace(/[^0-9.]/g, "")) || 0;
  const scores = useMemo(() => picosScores(outletType, picos), [outletType, picos]);
  const approval =
    budgetNum >= CM_APPROVAL_AED
      ? submitterIsSm
        ? "CM/TMM will approve this before Trade Marketing."
        : "Your Sales Manager, then CM/TMM, will approve this before Trade Marketing."
      : budgetNum >= SM_APPROVAL_AED && !submitterIsSm
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
    if (!(budgetNum > 0)) errs.budget = "Enter the budget in AED.";
    if (brief.trim().length < MIN_BRIEF_CHARS) errs.brief = `Describe the project in at least ${MIN_BRIEF_CHARS} characters.`;
    if (volumeBudget === "") errs.volumeBudget = "Enter the 2027 volume budget in HL.";
    if (incremental === "") errs.incrementalVolume = "Enter the incremental volume in HL.";
    if (!desiredDate) errs.desiredDate = "Choose the desired execution date.";
    if (outletType && !picosItemsFor(outletType).some((p) => picos.items[p.key]?.promised && !picos.items[p.key]?.current)) {
      errs.picos = "Tick at least one PICOS change negotiated in this deal.";
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
        budget: budgetNum,
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
          }}
          onContact={(c) => setContact(c)}
        />
        {err("account")}
      </Section>

      {account && (
        <Section n={2} title="Main customer contact" id="contactName">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="b-cname">Name</label>
              <input id="b-cname" className="field" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
              {err("contactName")}
            </div>
            <div>
              <label className="label" htmlFor="b-cmobile">Mobile</label>
              <input
                id="b-cmobile"
                className="field"
                type="tel"
                inputMode="tel"
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
              <input id="b-cemail" className="field" type="email" inputMode="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
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
            <Chips options={OUTLET_TYPES as readonly string[]} value={outletType ? [outletType] : []} onToggle={(v) => setOutletType(v)} />
            <p className="mt-1 text-xs">Sets which PICOS items count and how many points each is worth.</p>
            {err("outletType")}
          </div>
        </div>
      </Section>

      <Section n={4} title="Budget & volume" id="budget">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="b-budget">Budget (AED)</label>
            <input id="b-budget" className="field" inputMode="decimal" placeholder="e.g. 25000" value={budget} onChange={(e) => setBudget(e.target.value)} />
            {err("budget")}
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
        </div>
        {approval && (
          <p className="mt-3 rounded-lg bg-brand-light px-3 py-2 text-xs">
            <strong className="text-brand-black">{formatAed(budgetNum)}</strong> · {approval}
          </p>
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
          <PicosChecklist outletType={outletType} picos={picos} onChange={setPicos} scores={scores} />
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

      <div className="bento sticky bottom-3 z-10 flex flex-col gap-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
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

function PicosChecklist({ outletType, picos, onChange, scores }: { outletType: string; picos: Picos; onChange: (p: Picos) => void; scores: { current: number; promised: number } }) {
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
            <input
              className="field mt-2 !py-2 text-sm"
              placeholder={g === "Availability" ? "Details, e.g. new listing: Birra Moretti draught" : `${g} details (optional)`}
              value={picos.notes[noteKey] ?? ""}
              onChange={(e) => onChange({ ...picos, notes: { ...picos.notes, [noteKey]: e.target.value } })}
            />
          </div>
        );
      })}
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

/** Parent account search → outlet, as in POSM Shop. Pre-fills the last contact used under the parent. */
function OutletPicker({ account, onChange, onContact }: { account: Account | null; onChange: (a: Account | null) => void; onContact: (c: { name: string; mobile: string; email: string }) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParentAccount[]>([]);
  const [parent, setParent] = useState<ParentAccount | null>(null);
  const [outlets, setOutlets] = useState<Account[] | null>(null);
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
    createClient()
      .from("accounts")
      .select(ACCOUNT_FIELDS)
      .eq("parent_number", parent.parent_number)
      .eq("parent_name", parent.parent_name)
      .eq("active", true)
      .order("name")
      .then(({ data }) => setOutlets((data as Account[]) ?? []));
  }, [parent]);

  async function choose(o: Account) {
    onChange(o);
    const { data } = await createClient()
      .from("contacts")
      .select("*, accounts!inner(parent_number)")
      .eq("accounts.parent_number", o.parent_number)
      .order("created_at", { ascending: false })
      .limit(10);
    const list = (data as Contact[]) ?? [];
    const c = list.find((x) => x.account_id === o.id) ?? list[0];
    if (c) onContact({ name: c.name, mobile: c.mobile, email: c.email });
  }

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
        ) : (
          <ul className="divide-y divide-black/5">
            {outlets.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => choose(o)} className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left hover:bg-brand-green-tint">
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
