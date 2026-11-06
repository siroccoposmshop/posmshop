import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { hubRoleShort } from "@/lib/hub";
import { TARGET_YEAR, canUseOffTrade, loadOffTrade, offTradeTotals } from "@/lib/off-trade";
import { HubTool as Tool } from "./HubTool";
import { canApprove, hubRole, isProjectAdmin, loadVisibleProjects, projectHealth, type Project } from "@/lib/projects";

export const metadata = { title: "Commerce Hub" };
export const dynamic = "force-dynamic";

export default async function HubHome() {
  const profile = await requireProfile();
  const first = (profile.full_name ?? profile.email.split("@")[0]).split(/[\s.]/)[0];
  const firstName = first.charAt(0).toUpperCase() + first.slice(1);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dubai" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  let projects: Project[] = [];
  try {
    projects = await loadVisibleProjects(profile);
  } catch {
    // Projects not set up yet: the tile still links there.
  }
  projects = projects.filter((p) => !p.hidden_for_kam);
  const live = projects.filter((p) => p.status === "live");
  const behind = live.filter((p) => projectHealth(p).state === "behind").length;
  const approvals = projects.filter((p) => canApprove(profile, p)).length;
  const toVet = isProjectAdmin(profile) ? projects.filter((p) => p.status === "awaiting_tm").length : 0;
  // Off trade: Trade Marketing and admins only.
  const offTrade = canUseOffTrade(profile);
  let ot: ReturnType<typeof offTradeTotals> | null = null;
  if (offTrade) {
    try {
      ot = offTradeTotals(await loadOffTrade());
    } catch {
      // Not set up yet: the tile still links there.
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-sm uppercase tracking-[0.15em]">
          {greeting}, {firstName} · {hubRoleShort(hubRole(profile))}
        </p>
        <h1 className="accent-square mt-1 text-4xl text-brand-black sm:text-5xl">Commerce Hub</h1>
        <p className="mt-2 max-w-2xl text-sm">Everything for sales development in one place: order POSM, request and track projects, and find past work.</p>
      </div>

      {/* Four tools (with Off trade): a 2 × 2 grid. Three: one row on wide screens. */}
      <div className={`grid gap-4 md:grid-cols-2 ${offTrade ? "" : "lg:grid-cols-3"}`}>
        <Tool
          href="/projects"
          title="Projects"
          text="Brief a new project, follow it through every stage and see what's due."
          cta="Projects dashboard"
          highlight
          stats={[
            { label: "Live", value: live.length },
            ...(behind ? [{ label: "Behind", value: behind, red: true }] : []),
            ...(approvals ? [{ label: "To approve", value: approvals }] : []),
            ...(toVet ? [{ label: "To vet", value: toVet }] : []),
          ]}
          extra={
            <Link href="/projects/new" className="btn bg-white text-brand-green hover:bg-brand-light">
              + New project
            </Link>
          }
        />
        <Tool
          href="/posm"
          title="POSM Shop"
          text="Order glassware, coasters, bar mats and more for your outlets."
          cta="Start an order"
          extra={
            <Link href="/orders" className="btn btn-secondary">
              My orders
            </Link>
          }
        />
        {offTrade && (
          <Tool
            href="/off-trade"
            title="Off trade"
            text="Store universe, influence, past projects and the targets by area and TM."
            cta="Off-trade dashboard"
            stats={
              ot && ot.stores
                ? [
                    { label: "Stores", value: ot.stores },
                    { label: "Influenced", value: ot.influenced },
                    { label: `${TARGET_YEAR} targets`, value: ot.targeted },
                  ]
                : undefined
            }
          />
        )}
        <Tool href="/library" title="Marketing Library" text="Past projects to inspire the next one: bars, activations, furniture and more." cta="Coming soon" muted />
      </div>
    </div>
  );
}
