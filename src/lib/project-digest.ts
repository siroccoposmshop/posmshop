import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CM_APPROVAL_AED, isPast } from "@/lib/hub";
import { byUrgency, personName, type Person, type Project } from "@/lib/projects";
import { renderDigest, sendProjectEmail } from "@/lib/project-emails";

/**
 * Monday digest: KAMs get their open projects, SMs their team's, CM/TMM every open project
 * from CM_APPROVAL_AED. Nobody with nothing open is emailed.
 */
export async function sendWeeklyDigests() {
  const db = createAdminClient();
  const [{ data: rows, error }, { data: people }] = await Promise.all([
    db.from("projects").select("*, project_stages(*)").limit(2000),
    db.from("profiles").select("id, email, full_name, hub_role, manager_id").eq("active", true),
  ]);
  if (error) throw new Error(error.message);
  const projects = ((rows as Project[]) ?? [])
    .filter((p) => !isPast(p.status))
    .map((p) => ({ ...p, project_stages: [...(p.project_stages ?? [])].sort((a, b) => a.sort - b.sort) }))
    .sort(byUrgency);
  const byId = new Map(((people as Person[]) ?? []).map((p) => [p.id, p]));
  const kamName = (p: Project) => personName(byId.get(p.kam_id));

  let sent = 0;
  for (const person of byId.values()) {
    const first = (person.full_name ?? person.email.split("@")[0]).split(/[\s.]/)[0];
    const name = first.charAt(0).toUpperCase() + first.slice(1);
    let list: Project[] = [];
    let scope = "";
    if (person.hub_role === "kam") {
      list = projects.filter((p) => p.kam_id === person.id && !p.hidden_for_kam);
      scope = "where your projects stand";
    } else if (person.hub_role === "sm") {
      const team = new Set([person.id, ...[...byId.values()].filter((x) => x.manager_id === person.id).map((x) => x.id)]);
      list = projects.filter((p) => team.has(p.kam_id) || p.sm_id === person.id);
      scope = "where your team's projects stand";
    } else if (person.hub_role === "cm" || person.hub_role === "tmm") {
      list = projects.filter((p) => Number(p.budget_aed) >= CM_APPROVAL_AED);
      scope = `every open project of AED ${CM_APPROVAL_AED.toLocaleString("en-US")} or more`;
    }
    if (!list.length) continue;
    await sendProjectEmail([person.email], renderDigest(name, scope, list, kamName));
    sent++;
  }
  return { sent };
}
