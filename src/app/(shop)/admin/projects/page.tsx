import { loadHubSettings } from "@/lib/hub-settings";
import { loadStageTypes, stageTypesFor } from "@/lib/projects";
import { OUTLET_TYPES, PICOS_GROUPS, PICOS_ITEMS } from "@/lib/picos";
import { AddStage, SettingsForm, StageRow } from "./Forms";

export const metadata = { title: "Projects admin" };
export const dynamic = "force-dynamic";

export default async function ProjectsAdminPage() {
  const [settings, stages] = await Promise.all([loadHubSettings(), loadStageTypes()]);

  return (
    <div className="space-y-6">
      <h1 className="accent-square text-3xl text-brand-black">Projects</h1>

      <SettingsForm settings={settings} />

      {(["on", "off"] as const).map((trade) => {
        const list = stageTypesFor(stages, trade);
        return (
          <section key={trade} className="bento space-y-4">
            <div>
              <h2 className="text-xl text-brand-black">{trade === "on" ? "On-trade stages" : "Off-trade stages"}</h2>
              <p className="text-sm">
                {trade === "on"
                  ? "What Trade Marketing picks from when running an outlet project, in this order, with the default working days."
                  : "Offered when an off-trade store project is created, in this order, with the default working days (changeable per project)."}{" "}
                Untick to stop offering a stage; projects already using it keep it.
              </p>
            </div>
            {list.length === 0 ? (
              <p className="text-sm">
                {trade === "off" ? (
                  <>
                    Run <code>supabase/migrations/20261119000000_off_trade_projects_hub.sql</code> in Supabase to add the off-trade stages.
                  </>
                ) : (
                  "No stages yet."
                )}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Stage</th>
                      <th>Days</th>
                      <th className="text-center">Offered</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => (
                      <StageRow key={s.key} stage={s} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <AddStage trade={trade} />
          </section>
        );
      })}

      <section className="bento space-y-3">
        <div>
          <h2 className="text-xl text-brand-black">PICOS points</h2>
          <p className="text-sm">From the Sirocco scoring sheet. Each outlet type totals 100. Ask for a change if the sheet is updated.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Criterion</th>
                {OUTLET_TYPES.map((t) => (
                  <th key={t} className="whitespace-nowrap text-right">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PICOS_GROUPS.map((g) => (
                <GroupRows key={g} group={g} />
              ))}
              <tr>
                <td className="font-medium text-brand-black">Total</td>
                {OUTLET_TYPES.map((t, i) => (
                  <td key={t} className="text-right font-medium text-brand-black">{PICOS_ITEMS.reduce((n, p) => n + p.points[i], 0)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function GroupRows({ group }: { group: (typeof PICOS_GROUPS)[number] }) {
  return (
    <>
      <tr>
        <td colSpan={OUTLET_TYPES.length + 1} className="bg-brand-light font-display text-xs uppercase tracking-wide">{group}</td>
      </tr>
      {PICOS_ITEMS.filter((p) => p.group === group).map((p) => (
        <tr key={p.key}>
          <td>{p.label}</td>
          {p.points.map((n, i) => (
            <td key={i} className={`text-right ${n ? "text-brand-black" : "text-brand-grey/50"}`}>{n || "–"}</td>
          ))}
        </tr>
      ))}
    </>
  );
}
