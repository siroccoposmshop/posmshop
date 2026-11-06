// PICOS: what an outlet is scored on, and the points per outlet type (Sirocco scoring sheet).

export const OUTLET_TYPES = ["Pub", "Restaurant", "Bar", "Pool/Beach Bar", "Nightclub"] as const;
export type OutletType = (typeof OUTLET_TYPES)[number];

export type PicosGroup = "Availability" | "Visibility" | "Affordability";
export const PICOS_GROUPS: PicosGroup[] = ["Availability", "Visibility", "Affordability"];

type Weights = [number, number, number, number, number]; // Pub, Restaurant, Bar, Pool/Beach Bar, Nightclub

export const PICOS_ITEMS: { key: string; label: string; group: PicosGroup; points: Weights }[] = [
  { key: "hnk_draught", label: "Heineken Draught available", group: "Availability", points: [15, 15, 15, 15, 20] },
  { key: "focus_draught", label: "Focus brand Draught available", group: "Availability", points: [5, 5, 10, 10, 0] },
  { key: "hnk_packaged", label: "Heineken Packaged available", group: "Availability", points: [10, 10, 10, 10, 15] },
  { key: "focus_packaged", label: "Focus brand Packaged available", group: "Availability", points: [5, 5, 10, 5, 15] },
  { key: "sp_draught", label: "Special Price Draught Share (≥50%)", group: "Availability", points: [10, 5, 5, 5, 0] },
  { key: "sp_packaged", label: "Special Price Packaged Share (≥50%)", group: "Availability", points: [5, 5, 5, 5, 0] },
  { key: "hnk_font", label: "Heineken Brand Stand Alone font", group: "Visibility", points: [5, 10, 10, 5, 0] },
  { key: "hnk_font_location", label: "Heineken font in correct location", group: "Visibility", points: [5, 5, 0, 5, 0] },
  { key: "focus_font", label: "Focus brand Stand Alone font", group: "Visibility", points: [5, 0, 0, 0, 0] },
  { key: "tbar", label: "T-bar Badge Placement", group: "Visibility", points: [3, 0, 0, 0, 0] },
  { key: "badge_share", label: "Standalone/Badge Share (>50%)", group: "Visibility", points: [5, 0, 0, 5, 0] },
  { key: "menu", label: "In Menu (all Sirocco brands)", group: "Visibility", points: [5, 20, 15, 15, 25] },
  { key: "glassware", label: "Glassware (all Sirocco brands)", group: "Visibility", points: [5, 5, 5, 5, 5] },
  { key: "fridge", label: "Top shelf of fridge & 50% facings", group: "Visibility", points: [2, 5, 5, 5, 10] },
  { key: "pricing", label: "Correct Pricing (PTC & HH)", group: "Affordability", points: [15, 10, 10, 10, 10] },
];

export type PicosItemState = { current?: boolean; promised?: boolean; delivered_at?: string | null };
/** PICOS for another outlet under the same customer that this deal also improves. */
export type OtherOutletPicos = { account_number: string; name: string; outlet_type: string; items: Record<string, PicosItemState> };

export type Picos = {
  items: Record<string, PicosItemState>;
  notes: { availability?: string; visibility?: string; affordability?: string };
  /** Other outlets under the same customer, by account id. */
  others?: Record<string, OtherOutletPicos>;
};

export function pointsFor(key: string, outletType: string) {
  const i = OUTLET_TYPES.indexOf(outletType as OutletType);
  const item = PICOS_ITEMS.find((p) => p.key === key);
  return i < 0 || !item ? 0 : item.points[i];
}

/** The items that count for this outlet type. */
export function picosItemsFor(outletType: string) {
  return PICOS_ITEMS.filter((p) => pointsFor(p.key, outletType) > 0);
}

/** Score now, and once everything negotiated is in place (out of 100). */
export function picosScores(outletType: string, picos: Picos) {
  let current = 0;
  let promised = 0;
  for (const p of picosItemsFor(outletType)) {
    const s = picos.items[p.key] ?? {};
    const pts = pointsFor(p.key, outletType);
    if (s.current) current += pts;
    if (s.current || s.promised) promised += pts;
  }
  return { current, promised };
}

/** Items negotiated in this project (not in place before). */
export function promisedItems(outletType: string, picos: Picos) {
  return picosItemsFor(outletType).filter((p) => picos.items[p.key]?.promised && !picos.items[p.key]?.current);
}

/**
 * Maps an outlet type as written in the outlet details (Excel / Salesforce "Sirocco Outlet Type")
 * to one of the PICOS scoring types, or null if it doesn't clearly match one.
 */
export function scoringOutletType(raw: string | null | undefined): OutletType | null {
  const s = (raw ?? "").toLowerCase();
  if (!s.trim()) return null;
  if (/night\s*club/.test(s)) return "Nightclub";
  if (/pool|beach/.test(s)) return "Pool/Beach Bar";
  if (/\bclub\b/.test(s)) return "Nightclub";
  if (/\bpub\b|tavern|inn\b/.test(s)) return "Pub";
  if (/restaurant|dining|bistro|brasserie|cafe|café|steak/.test(s)) return "Restaurant";
  if (/\bbar\b|lounge|terrace|rooftop/.test(s)) return "Bar";
  return null;
}

/** Negotiated items for another outlet. */
export const otherPromised = (o: OtherOutletPicos) => promisedItems(o.outlet_type, { items: o.items, notes: {} });

/** Whether the deal negotiates anything, at this outlet or another one under the customer. */
export function anyNegotiated(outletType: string, picos: Picos) {
  return promisedItems(outletType, picos).length > 0 || Object.values(picos.others ?? {}).some((o) => otherPromised(o).length > 0);
}

/** Other outlets with something ticked and a known outlet type, as entered (others are dropped). */
export function otherOutletsWithTicks(picos: Picos) {
  return Object.entries(picos.others ?? {}).filter(
    ([, o]) => OUTLET_TYPES.includes(o.outlet_type as OutletType) && picosItemsFor(o.outlet_type).some((i) => o.items[i.key]?.current || o.items[i.key]?.promised),
  );
}

/** One negotiated PICOS change at one outlet, delivered or still to do. */
export type PicosLine = {
  outletId: string | null;
  outlet: string;
  outletType: string;
  key: string;
  label: string;
  group: PicosGroup;
  points: number;
  deliveredAt: string | null;
};

/** Every negotiated change in a deal: at the main outlet (outletId null) and the other outlets. */
export function picosLines(p: { account_name: string; outlet_type: string; picos: Picos }): PicosLine[] {
  const lines: PicosLine[] = promisedItems(p.outlet_type, p.picos).map((i) => ({
    outletId: null,
    outlet: p.account_name,
    outletType: p.outlet_type,
    key: i.key,
    label: i.label,
    group: i.group,
    points: pointsFor(i.key, p.outlet_type),
    deliveredAt: p.picos.items[i.key]?.delivered_at ?? null,
  }));
  for (const [id, o] of otherOutletsWithTicks(p.picos)) {
    for (const i of otherPromised(o)) {
      lines.push({ outletId: id, outlet: o.name, outletType: o.outlet_type, key: i.key, label: i.label, group: i.group, points: pointsFor(i.key, o.outlet_type), deliveredAt: o.items[i.key]?.delivered_at ?? null });
    }
  }
  return lines;
}
