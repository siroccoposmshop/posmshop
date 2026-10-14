import { ItemImage } from "./ItemImage";
import { money } from "@/lib/format";
import { MARKETS } from "@/lib/markets";

/** Shared by the confirm-order page and the order page so they look the same. */

export type DeliveryInfo = {
  outletName: string;
  outletNumber: string;
  parentName?: string | null;
  parentNumber?: string | null;
  market: string;
  contactName: string;
  contactMobile: string;
  contactEmail: string;
};

export function DeliveryCards({ info }: { info: DeliveryInfo }) {
  const marketName = MARKETS.find((m) => m.code === info.market)?.name ?? info.market;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="bento">
        <h2 className="label">Deliver to</h2>
        <p className="font-display text-xl font-medium uppercase leading-tight text-brand-black">{info.outletName}</p>
        {info.parentName && <p className="mt-1 text-sm leading-snug">{info.parentName}</p>}
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-black/5 pt-3 text-xs">
          <div>
            <dt className="uppercase tracking-wide text-brand-grey/70">Outlet</dt>
            <dd className="font-medium text-brand-black">{info.outletNumber}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide text-brand-grey/70">Account</dt>
            <dd className="font-medium text-brand-black">{info.parentNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide text-brand-grey/70">Market</dt>
            <dd className="font-medium text-brand-black">{marketName}</dd>
          </div>
        </dl>
      </div>
      <div className="bento">
        <h2 className="label">Contact</h2>
        <p className="font-display text-xl font-medium uppercase leading-tight text-brand-black">{info.contactName}</p>
        <ul className="mt-3 space-y-2 border-t border-black/5 pt-3 text-sm">
          <li className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-brand-green" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" strokeLinejoin="round" />
            </svg>
            <a href={`tel:${info.contactMobile.replace(/\s/g, "")}`} className="text-brand-black no-underline">
              {info.contactMobile}
            </a>
          </li>
          <li className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-brand-green" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" strokeLinejoin="round" />
            </svg>
            <a href={`mailto:${info.contactEmail}`} className="min-w-0 break-all text-brand-black no-underline">
              {info.contactEmail}
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}

export type SummaryLine = {
  key: string;
  name: string;
  brand: string;
  sku: string;
  image_path: string | null;
  qty: number;
  /** USD — shown in AED */
  lineValue: number;
};

export function OrderLinesTable({ lines, total }: { lines: SummaryLine[]; total: number }) {
  return (
    <div className="bento overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th className="hidden sm:table-cell" />
            <th>Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.key}>
              <td className="hidden w-14 sm:table-cell">
                <div className="h-12 w-12 overflow-hidden rounded bg-brand-light">
                  <ItemImage path={l.image_path} alt={l.name} />
                </div>
              </td>
              <td>
                <span className="block font-medium text-brand-black">{l.name}</span>
                <span className="text-xs">
                  {l.brand} · {l.sku}
                </span>
              </td>
              <td className="text-right">{l.qty}</td>
              <td className="whitespace-nowrap text-right">{money(l.lineValue)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="hidden sm:table-cell" />
            <td colSpan={2} className="text-right font-display font-medium uppercase">
              Total
            </td>
            <td className="whitespace-nowrap text-right text-lg font-medium text-brand-black">{money(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
