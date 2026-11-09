import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hubRole, loadProject, loadStageTypes, stageTypesFor } from "@/lib/projects";
import { budgetSplit, canUseOffTrade, isAdminProfile } from "@/lib/hub";
import { loadHubSettings } from "@/lib/hub-settings";
import type { Account } from "@/lib/types";
import { BriefForm, type BriefDefaults } from "./BriefForm";

export const metadata = { title: "New project" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const profile = await requireProfile();
  const { edit } = await searchParams;
  const db = createAdminClient();
  const { data: brandRows } = await db.from("items").select("brand");
  const brands = [...new Set((brandRows ?? []).map((b) => b.brand as string))].filter((b) => !/unbranded/i.test(b)).sort();

  let defaults: BriefDefaults | undefined;
  if (edit) {
    const p = await loadProject(edit, profile);
    if (p && p.kam_id === profile.id) {
      const { data: account } = p.account_id ? await db.from("accounts").select("*").eq("id", p.account_id).maybeSingle() : { data: null };
      defaults = {
        projectId: p.id,
        account: account as Account | null,
        projectType: p.project_type,
        brands: p.brands,
        outletType: p.outlet_type,
        contact: { name: p.contact_name, mobile: p.contact_mobile, email: p.contact_email },
        budgetBif: budgetSplit(p).bif,
        budgetExtra: budgetSplit(p).extra || null,
        budgetExtraSource: budgetSplit(p).source,
        brief: p.brief,
        volumeBudget: p.volume_budget_hl,
        incrementalVolume: p.incremental_volume_hl,
        desiredDate: p.desired_date,
        picos: p.picos,
      };
    }
  }

  // On trade: everyone except users set up as off trade only. Off trade: the off-trade team and admins.
  const canOff = !defaults && canUseOffTrade(profile);
  const canOn = !!defaults || isAdminProfile(profile) || !profile.trade?.length || profile.trade.includes("on");
  const offStageTypes = canOff ? stageTypesFor(await loadStageTypes(), "off").filter((t) => t.active !== false) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/projects" className="text-sm underline">
        ← Projects
      </Link>
      <h1 className="accent-square mt-2 text-4xl text-brand-black">{defaults ? "Update request" : "New project"}</h1>
      <p className="mt-2 text-sm">
        {canOff && !canOn
          ? "An off-trade store project: choose the store, complete each section, then create it."
          : canOff
            ? "Choose an on-trade outlet for a briefing to Trade Marketing, or an off-trade store for a store project. The form follows what you choose."
            : "The briefing document for Trade Marketing. Complete every section, then submit."}
      </p>
      <BriefForm
        brands={brands}
        defaults={defaults}
        submitterIsSm={hubRole(profile) === "sm"}
        settings={await loadHubSettings()}
        canOn={canOn}
        canOff={canOff}
        offStageTypes={offStageTypes}
      />
    </div>
  );
}
