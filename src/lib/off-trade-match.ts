/**
 * Matching store names from other spreadsheets to the off-trade store list, when there are no store
 * codes: exact name, then loose (punctuation, word order, small words, typos), within the market
 * when known. Stores of the same chain are tried first, then independents. Only an unambiguous match
 * is used; anything else is reported as unmatched.
 */

export type MatchStore = { id: string; code: string; name: string; chain: string | null; market: string | null; bar?: boolean };

const SMALL = new Set(["the", "and", "of", "at", "store", "shop", "branch", "llc", "trading", "general", "marketing"]);
// Spellings that vary between files.
const SPELLINGS: [RegExp, string][] = [
  [/\bmus+af+ah\b/g, "musaffah"],
  [/\bindustrial retail\b/g, "ir"],
];
export const normName = (s: string | null | undefined) => {
  let n = (s ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\b0+(\d)/g, "$1").trim();
  for (const [re, to] of SPELLINGS) n = n.replace(re, to);
  return n;
};
const tokens = (s: string) => new Set(normName(s).split(" ").filter((t) => t && !SMALL.has(t)));

/** At most one letter added, dropped or changed ("Trubell" / "Truebell"). */
function oneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
/** Same word, allowing a typo in longer words, or a short form ("Fuj" for Fujairah). */
const sameWord = (a: string, b: string) =>
  a === b || (a.length >= 5 && b.length >= 5 && oneEdit(a, b)) || (a.length >= 3 && !/\d/.test(a) && b.startsWith(a)) || (b.length >= 3 && !/\d/.test(b) && a.startsWith(b));
const shares = (a: Set<string>, b: Set<string>) => [...a].some((x) => [...b].some((y) => sameWord(x, y)));
const numbersAgree = (q: Set<string>, s: Set<string>) => {
  const qn = [...q].filter((t) => /^\d+$/.test(t));
  const sn = [...s].filter((t) => /^\d+$/.test(t));
  return qn.every((d) => s.has(d)) && sn.every((d) => q.has(d));
};

function similarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let both = 0;
  for (const t of a) if ([...b].some((u) => sameWord(t, u))) both++;
  // Overlap against the smaller set, so "TBS Khalidiya" ~ "The Bottle Store - TBS Khalidiya".
  return both / Math.min(a.size, b.size) - (Math.max(a.size, b.size) - both) * 0.05;
}

export function makeStoreMatcher(stores: MatchStore[]) {
  const byCode = new Map(stores.filter((s) => s.code).map((s) => [s.code.toUpperCase(), s.id]));
  const prepared = stores.map((s) => ({ ...s, n: normName(s.name), t: tokens(s.name), c: tokens(s.chain ?? ""), independent: /independent/i.test(s.chain ?? "") }));
  type P = (typeof prepared)[number];

  return function match(q: { code?: string | null; name?: string | null; chain?: string | null; market?: string | null }): string | undefined {
    if (q.code && byCode.has(q.code.toUpperCase())) return byCode.get(q.code.toUpperCase());
    if (!q.name) return undefined;
    // A note in brackets ("NCTH Dhafra (Renovation)") isn't part of the name.
    const name = q.name.replace(/\([^)]*\)/g, " ").trim() || q.name;
    const qt = tokens(name);
    const qc = /independent/i.test(q.chain ?? "") ? new Set<string>() : tokens(q.chain ?? "");
    const n = normName(name);
    const market = q.market ? prepared.filter((s) => !s.market || s.market === q.market) : prepared;
    const ok = market.filter((s) => numbersAgree(qt, s.t));
    // Same chain first (a shared word, typos allowed, or the whole chain name in the store's name),
    // then stores with no chain or independents.
    const chainIn = (s: P) => shares(qc, s.c) || [...qc].every((x) => [...s.t].some((y) => sameWord(x, y)));
    const sameChain = qc.size ? ok.filter((s) => s.c.size && !s.independent && chainIn(s)) : [];
    const loose = ok.filter((s) => !qc.size || !s.c.size || s.independent || chainIn(s));
    // Industrial retail sites: "MMI Al Quoz IR 1" → "MMI Industrial Retail 1 - Al Quoz 4". The site
    // number and the place must both agree; with no number, the place alone.
    if (qt.has("ir")) {
      const num = n.match(/\bir (\d+)\b/)?.[1];
      const place = [...qt].filter((t) => t !== "ir" && t !== num && !qc.has(t) && !/^\d+$/.test(t));
      const sites = market.filter((s) => s.t.has("ir") && (!qc.size || chainIn(s)) && place.every((t) => [...s.t].some((w) => sameWord(t, w))));
      const hits = num ? sites.filter((s) => s.n.match(/\bir (\d+)\b/)?.[1] === num) : sites;
      if (place.length && hits.length === 1) return hits[0].id;
    }
    for (const pool of qc.size ? [sameChain, loose] : [loose]) {
      const hit = matchIn(pool);
      if (hit) return hit;
    }
    // Last, a name that's unique in the market whatever the chain ("Dolphin Bulk Store" filed under OUA).
    const exact = ok.filter((s) => s.n === n);
    return exact.length === 1 ? exact[0].id : undefined;

    function matchIn(pool: P[]): string | undefined {
      const chainTier = pool === sameChain;
      if (!pool.length) return undefined;
      const exact = pool.filter((s) => s.n === n);
      if (exact.length === 1) return exact[0].id;
      const scored = pool.map((s) => ({ s, score: similarity(qt, s.t) })).sort((a, b) => b.score - a.score);
      const [best, next] = scored;
      if (best && best.score >= 0.75 && (!next || best.score - next.score >= 0.15)) return best.s.id;
      // A site with a retail shop and bars under one name ("Richmond - Musaffah" → "… - Retail Shop").
      // Within the chain, the chain's own words don't help; across independents they're part of the name.
      const core = chainTier ? [...qt].filter((t) => !qc.has(t) || qt.size === 1) : [...qt];
      const containing = pool.filter((s) => core.length && core.every((t) => [...s.t, ...s.c].some((w) => sameWord(t, w))));
      const shops = containing.filter((s) => !s.bar);
      if (shops.length === 1) return shops[0].id;
      // Initials: "MMI JGE" → "MMI Jumerah Golf Estate".
      const initials = core.find((t) => t.length >= 2 && t.length <= 5 && !/\d/.test(t));
      if (initials) {
        const hits = pool.filter((s) => {
          const words = [...s.t].filter((t) => !s.c.has(t) && !qc.has(t));
          return words.length === initials.length && words.map((w) => w[0]).join("") === initials;
        });
        if (hits.length === 1) return hits[0].id;
      }
      return undefined;
    }
  };
}
