/** Markets POSM SHOP runs in. Keep in sync with the `markets` table. */
export const MARKETS = [
  { code: "DXB", name: "Dubai" },
  { code: "AUH", name: "Abu Dhabi" },
  { code: "NE", name: "Northern Emirates" },
] as const;

export type MarketCode = (typeof MARKETS)[number]["code"];
export const MARKET_CODES = MARKETS.map((m) => m.code) as MarketCode[];
