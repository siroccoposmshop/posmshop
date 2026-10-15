/**
 * Order of items within a brand on the shop:
 *   1. The current 2026 glasses (Heineken Star Glass, Moretti 1859): pint, half pint, then other sizes
 *   2. Pints   3. Half pints   4. Coasters   5. Everything else
 * Within pints and half pints, standard glass comes first, then pre-2025 / refurbished,
 * then poly / plastic / paper.
 */
type Sortable = { name: string; category: string | null };

const FEATURED = /\b2026\b|1859|STAR GLASS/i;

function kind(i: Sortable) {
  const n = i.name.toUpperCase();
  const c = (i.category ?? "").toUpperCase();
  if (c.startsWith("COASTER") && !c.includes("HOLDER")) return 2;
  if (/\bCOASTERS?\b/.test(n) && !/HOLDER/.test(n)) return 2;
  if (/HOLDER/.test(n)) return 3;
  if (/HALF\s*PINT|\b25\s?CL\b|\b30\s?CL\b/.test(n)) return 1;
  if (/\bPINT\b|\b50\s?CL\b|STEIN|\bMUG\b/.test(n)) return 0;
  return 3;
}

function variant(i: Sortable) {
  const n = i.name.toUpperCase();
  if (/POLY|POLCARB|PLASTIC|PAPER/.test(n)) return 2;
  if (/REFURB|PRE\s*20\d\d/.test(n)) return 1;
  return 0;
}

export function compareItems(a: Sortable, b: Sortable) {
  const fa = FEATURED.test(a.name) ? 0 : 1;
  const fb = FEATURED.test(b.name) ? 0 : 1;
  return fa - fb || kind(a) - kind(b) || variant(a) - variant(b) || a.name.localeCompare(b.name);
}
