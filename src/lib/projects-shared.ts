// Small helpers about projects that the browser can use too (src/lib/projects.ts is server-only).
import { companyName, outletName } from "@/lib/format";

export const projectTitle = (p: { name: string | null; account_name: string; project_type: string }) => p.name || `${p.project_type} · ${outletName(p.account_name)}`;

/** "The Duck Hook Restaurant · Sarood Hospitality": the short outlet name, plus the company when it adds something. */
export function outletLine(p: { account_name: string; parent_name?: string | null }) {
  const outlet = outletName(p.account_name);
  const company = companyName(p.parent_name || p.account_name);
  return company && company.toLowerCase() !== outlet.toLowerCase() ? `${outlet} · ${company}` : outlet;
}
