import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { canUseOffTrade } from "@/lib/off-trade";
import { OffTradeImportForm } from "./ImportForm";

export const metadata = { title: "Upload off-trade stores" };

export default async function OffTradeImportPage() {
  const profile = await requireProfile();
  if (!canUseOffTrade(profile)) redirect("/");
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="accent-square text-3xl text-brand-black">Upload stores</h1>
        <p className="mt-2 text-sm">
          An Excel with a <strong>Stores</strong> sheet (Store code, Store name, Chain, Market, Area, TM, Segment, Influence Y/N, Target year, Visit
          frequency) and, optionally, a <strong>Projects</strong> sheet (Store code, Type, Status, Year, Planned date, Completed date, Expected
          cost, Actual cost, Notes). Stores are matched on store code, so uploading again updates them; projects already uploaded are
          updated, not duplicated. Later the stores will come from Salesforce.{" "}
          <a href="/off-trade/import/template" className="underline">
            Download the template
          </a>
          .
        </p>
      </div>
      <OffTradeImportForm />
    </div>
  );
}
