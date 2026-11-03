import "server-only";

/**
 * Read-only access to Salesforce Accounts (OAuth 2.0 Client Credentials flow, integration user).
 *
 * Env:
 *   SALESFORCE_DOMAIN         e.g. https://mmielr.my.salesforce.com
 *   SALESFORCE_CLIENT_ID      Connected App consumer key
 *   SALESFORCE_CLIENT_SECRET  Connected App consumer secret
 *   SALESFORCE_FIELDS         optional JSON overriding field API names, e.g. {"kam":"Sirocco_KAM__c"}
 *
 * Custom fields are found by their labels as shown on the Account page, so their API names
 * don't need to be known in advance.
 */

const API_VERSION = "v62.0";

export type SalesforceConfig = { domain: string; clientId: string; clientSecret: string };

export function salesforceConfig(): SalesforceConfig | null {
  const domain = process.env.SALESFORCE_DOMAIN?.trim().replace(/\/$/, "");
  const clientId = process.env.SALESFORCE_CLIENT_ID?.trim();
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET?.trim();
  if (!domain || !clientId || !clientSecret) return null;
  return { domain: /^https?:\/\//.test(domain) ? domain : `https://${domain}`, clientId, clientSecret };
}

/** Which of the settings are missing, for the admin page. */
export function missingSalesforceSettings() {
  return ["SALESFORCE_DOMAIN", "SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET"].filter((k) => !process.env[k]?.trim());
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/** Custom Account fields POSM SHOP uses, matched by label. */
const FIELD_LABELS = {
  kam: ["Sirocco KAM"],
  parentKam: ["Parent Sirocco KAM"],
  companyCode: ["Company Code"],
  open: ["PICOS Tracking"],
  tempClosed: ["Temp Closed"],
  externalId: ["External ID"],
  outletType: ["Sirocco Outlet Type"],
} as const;
export type FieldKey = keyof typeof FIELD_LABELS;
const REQUIRED: FieldKey[] = ["companyCode", "open"];

type DescribeField = { name: string; label: string; type: string; relationshipName?: string | null };
/** A resolved field: its API name, and the path to select (lookups select the related record's Name). */
export type ResolvedField = { name: string; label: string; type: string; select: string };
export type ResolvedFields = Partial<Record<FieldKey, ResolvedField>>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function resolveFields(describe: DescribeField[], overrides: Partial<Record<FieldKey, string>> = {}) {
  const fields: ResolvedFields = {};
  const missing: string[] = [];
  for (const key of Object.keys(FIELD_LABELS) as FieldKey[]) {
    const wanted = overrides[key];
    const f = wanted
      ? describe.find((d) => d.name.toLowerCase() === wanted.toLowerCase())
      : describe.find((d) => FIELD_LABELS[key].some((l) => norm(d.label) === norm(l)));
    if (!f) {
      if (REQUIRED.includes(key) || wanted) missing.push(wanted ? `${key} (${wanted})` : FIELD_LABELS[key][0]);
      continue;
    }
    const select = f.type === "reference" && f.relationshipName ? `${f.relationshipName}.Name` : f.name;
    fields[key] = { name: f.name, label: f.label, type: f.type, select };
  }
  return { fields, missing };
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

type Session = { token: string; instanceUrl: string };

async function sfFetch(url: string, init: RequestInit, what: string) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      detail = Array.isArray(j) ? j.map((e) => e.message).join("; ") : (j.error_description ?? j.error ?? detail);
    } catch {
      // keep the raw text
    }
    throw new Error(`Salesforce ${what} failed (${res.status}): ${detail}`);
  }
  return JSON.parse(text);
}

async function signIn(cfg: SalesforceConfig): Promise<Session> {
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: cfg.clientId, client_secret: cfg.clientSecret });
  const j = await sfFetch(`${cfg.domain}/services/oauth2/token`, { method: "POST", body }, "sign-in");
  return { token: j.access_token, instanceUrl: (j.instance_url ?? cfg.domain).replace(/\/$/, "") };
}

const get = (s: Session, path: string, what: string) =>
  sfFetch(path.startsWith("http") ? path : `${s.instanceUrl}${path}`, { headers: { Authorization: `Bearer ${s.token}` } }, what);

export type SalesforceAccount = Record<string, unknown>;

/** Signs in, finds the fields, and reads every Account marked open (PICOS Tracking). */
export async function fetchSalesforceAccounts(cfg: SalesforceConfig) {
  const session = await signIn(cfg);
  const describe = await get(session, `/services/data/${API_VERSION}/sobjects/Account/describe`, "reading Account fields");
  let overrides: Partial<Record<FieldKey, string>> = {};
  try {
    overrides = JSON.parse(process.env.SALESFORCE_FIELDS || "{}");
  } catch {
    throw new Error("SALESFORCE_FIELDS isn't valid JSON.");
  }
  const { fields, missing } = resolveFields(describe.fields as DescribeField[], overrides);
  if (missing.length) throw new Error(`Couldn't find these Account fields in Salesforce: ${missing.join(", ")}.`);

  const select = ["Id", "Name", "AccountNumber", "ParentId", "Parent.Name", "Parent.AccountNumber"];
  for (const f of Object.values(fields)) if (f && !select.includes(f.select)) select.push(f.select);
  // A checkbox can be filtered in the query; anything else is checked after reading.
  const where = fields.open!.type === "boolean" ? ` WHERE ${fields.open!.name} = true` : "";
  const soql = `SELECT ${select.join(", ")} FROM Account${where}`;

  const records: SalesforceAccount[] = [];
  let page = await get(session, `/services/data/${API_VERSION}/query?q=${encodeURIComponent(soql)}`, "reading accounts");
  records.push(...page.records);
  while (!page.done && page.nextRecordsUrl) {
    page = await get(session, page.nextRecordsUrl, "reading accounts");
    records.push(...page.records);
  }
  return { records, fields };
}

// ---------------------------------------------------------------------------
// Mapping (no network): Salesforce records → POSM SHOP account rows
// ---------------------------------------------------------------------------

export type AccountRow = {
  account_number: string;
  name: string;
  parent_number: string;
  parent_name: string;
  kam_name: string | null;
  market: string;
  active: boolean;
  salesforce_id: string;
  outlet_type: string | null;
};

/** Reads a value by select path, e.g. "Owner__r.Name". */
function pick(record: SalesforceAccount, path: string): unknown {
  return path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), record);
}
const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const truthy = (v: unknown) => v === true || /^(true|yes|y|1|open)$/i.test(text(v));
const first5 = (n: string) => n.match(/^\d{5}/)?.[0];

export function planAccountRows(records: SalesforceAccount[], fields: ResolvedFields, companyMarkets: Map<string, string>) {
  const rows: AccountRow[] = [];
  const seen = new Set<string>();
  const skipped = { notOpen: 0, noNumber: 0, duplicate: [] as string[], unmappedCodes: {} as Record<string, number> };
  const val = (r: SalesforceAccount, key: FieldKey) => (fields[key] ? pick(r, fields[key]!.select) : undefined);

  for (const r of records) {
    if (!truthy(val(r, "open"))) {
      skipped.notOpen++;
      continue;
    }
    const number = text(r.AccountNumber);
    if (!number) {
      skipped.noNumber++;
      continue;
    }
    const code = text(val(r, "companyCode")).toUpperCase();
    const market = companyMarkets.get(code);
    if (!market) {
      const label = code || "(blank)";
      skipped.unmappedCodes[label] = (skipped.unmappedCodes[label] ?? 0) + 1;
      continue;
    }
    if (seen.has(number)) {
      skipped.duplicate.push(`${number} (${code})`);
      continue;
    }
    seen.add(number);

    const name = text(r.Name) || number;
    const parentName = text(pick(r, "Parent.Name"));
    const parentNumber = text(pick(r, "Parent.AccountNumber"));
    rows.push({
      account_number: number,
      name,
      parent_name: parentName || name,
      parent_number: parentNumber || first5(number) || number,
      kam_name: text(val(r, "kam")) || text(val(r, "parentKam")) || null,
      market,
      active: !truthy(val(r, "tempClosed")),
      salesforce_id: text(r.Id),
      outlet_type: text(val(r, "outletType")) || null,
    });
  }
  return { rows, skipped };
}
