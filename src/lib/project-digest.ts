import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPast } from "@/lib/hub";
import { loadHubSettings } from "@/lib/hub-settings";
import { byUrgency, personName, type Person, type Project } from "@/lib/projects";
import { picosLines } from "@/lib/picos";
import { renderDigest, sendProjectEmail } from "@/lib/project-emails";

/**
 * Monday digest: KAMs get their open projects, SMs their team's, CM/TMM every open project
 * from the CM/TMM approval threshold. Each also gets completed projects with PICOS still to
 * deliver (their own, their team's, or all). Nobody with nothing to report is emailed.
 */
export async function sendWeeklyDigests() {
  const db = createAdminClient();
  const [{ data: rows, error }, { data: people }] = await Promise.all([
    db.from("projects").select("*, project_stages(*)").limit(2000),
    db.from("profiles").select("id, email, full_name, hub_role, manager_id").eq("active", true),
  ]);
  if (error) throw new Error(error.message);
  const all = ((rows as Project[]) ?? []).filter((p) => !p.hidden_for_kam);
  const picosDue = all
    .filter((p) => p.status === "completed" && picosLines(p).some((l) => !l.deliveredAt))
    .sort((a, b) => String(a.completed_at).localeCompare(String(b.completed_at)));
  const projects = all
    .filter((p) => !isPast(p.status))
    .map((p) => ({ ...p, project_stages: [...(p.project_stages ?? [])].sort((a, b) => a.sort - b.sort) }))
    .sort(byUrgency);
  const { cmApprovalAed } = await loadHubSettings();
  const byId = new Map(((people as Person[]) ?? []).map((p) => [p.id, p]));
  const kamName = (p: Project) => personName(byId.get(p.kam_id));

  let sent = 0;
  for (const person of byId.values()) {
    const first = (person.full_name ?? person.email.split("@")[0]).split(/[\s.]/)[0];
    const name = first.charAt(0).toUpperCase() + first.slice(1);
    let list: Project[] = [];
    let due: Project[] = [];
    let scope = "";
    if (person.hub_role === "kam") {
      list = projects.filter((p) => p.kam_id === person.id);
      due = picosDue.filter((p) => p.kam_id === person.id);
      scope = "where your projects stand";
    } else if (person.hub_role === "sm") {
      const team = new Set([person.id, ...[...byId.values()].filter((x) => x.manager_id === person.id).map((x) => x.id)]);
      list = projects.filter((p) => team.has(p.kam_id) || p.sm_id === person.id);
      due = picosDue.filter((p) => team.has(p.kam_id) || p.sm_id === person.id);
      scope = "where your team's projects stand";
    } else if (person.hub_role === "cm" || person.hub_role === "tmm") {
      list = projects.filter((p) => Number(p.budget_aed) >= cmApprovalAed);
      due = picosDue;
      scope = `every open project of AED ${cmApprovalAed.toLocaleString("en-US")} or more`;
    }
    if (!list.length && !due.length) continue;
    await sendProjectEmail([person.email], renderDigest(name, scope, list, kamName, due));
    sent++;
  }
  return { sent };
}
