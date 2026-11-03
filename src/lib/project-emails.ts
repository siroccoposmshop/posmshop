import "server-only";
import { Resend } from "resend";
import { EXTRA_SOURCE_LABEL, STATUS_LABEL, budgetSplit, gpCheck, gpWarningText } from "@/lib/hub";
import { formatDate } from "@/lib/format";
import { projectHealth, projectTitle, type Project } from "@/lib/projects";

// Same look as the POSM order emails.
const GREEN = "#58a244";
const GREY = "#545658";
const LIGHT = "#ebe9e9";
const RED = "#cb3727";
const FONT = "'Roboto Condensed','Arial Narrow',Arial,sans-serif";
const BODY = "Vazirmatn,'Segoe UI',Arial,sans-serif";
const LABEL = `font-family:${FONT};font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:${GREY}`;
const VALUE = `font-family:${BODY};font-size:14px;line-height:1.4;color:#000`;

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const aed = (n: number) => `AED ${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const date = (d: string | null | undefined) => (d ? formatDate(d) : "—");

function field(label: string, value: string) {
  return `<div style="${LABEL}">${label}</div><div style="${VALUE};margin-top:1px">${value}</div>`;
}
function pair(a: string, b?: string) {
  return b === undefined
    ? `<tr><td colspan="2" style="padding:0 0 10px">${a}</td></tr>`
    : `<tr><td width="50%" style="padding:0 8px 10px 0;vertical-align:top">${a}</td><td width="50%" style="padding:0 0 10px;vertical-align:top">${b}</td></tr>`;
}

/** Status pill: green on track, amber due soon, red behind, grey otherwise. */
function pill(p: Project) {
  const h = projectHealth(p);
  const [bg, text] =
    h.state === "behind"
      ? [RED, h.daysLate ? `Behind · ${h.daysLate}d` : "Behind"]
      : h.state === "due_soon"
        ? ["#d08a14", "Stage due soon"]
        : h.state === "on_track"
          ? [GREEN, "On track"]
          : [GREY, STATUS_LABEL[p.status]];
  return `<span style="display:inline-block;padding:3px 9px;border-radius:999px;background:${bg};color:#fff;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap">${esc(text)}</span>`;
}

/** Stage list with done / current / next markers. */
function stagesTable(p: Project) {
  const stages = p.project_stages ?? [];
  if (!stages.length) return "";
  const rows = stages
    .map((s) => {
      const dot =
        s.status === "done"
          ? `<span style="display:inline-block;width:16px;height:16px;border-radius:999px;background:${GREEN};color:#fff;font-size:11px;line-height:16px;text-align:center">✓</span>`
          : s.status === "active"
            ? `<span style="display:inline-block;width:12px;height:12px;border-radius:999px;border:2px solid ${GREEN};background:#fff"></span>`
            : `<span style="display:inline-block;width:12px;height:12px;border-radius:999px;border:2px solid #cfcdcd;background:#fff"></span>`;
      const name = s.status === "active" ? `<strong style="color:#000">${esc(s.name)}</strong>` : esc(s.name);
      const when = s.status === "done" ? `Done ${date(s.completed_at)}` : `Due ${date(s.due_date)}`;
      return `<tr>
        <td width="26" style="padding:6px 0;border-bottom:1px solid #eeeded;vertical-align:middle">${dot}</td>
        <td style="padding:6px 8px 6px 0;border-bottom:1px solid #eeeded;${VALUE};color:${s.status === "pending" ? GREY : "#000"}">${name}</td>
        <td align="right" style="padding:6px 0;border-bottom:1px solid #eeeded;font-family:${BODY};font-size:12px;color:${GREY};white-space:nowrap">${when}</td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 6px">
    <tr><th colspan="3" align="left" style="padding:4px 0;border-bottom:2px solid ${GREEN};${LABEL};font-weight:500">Stages</th></tr>${rows}</table>`;
}

function budgetHtml(p: Project) {
  const b = budgetSplit(p);
  if (!b.source) return aed(b.total);
  const extra = `${EXTRA_SOURCE_LABEL[b.source]} ${aed(b.extra)}`;
  return `<strong>${aed(b.total)}</strong><br><span style="font-size:12px;color:${GREY}">BIF ${aed(b.bif)} · ${b.source === "sirocco" ? `<strong style="color:${RED}">${extra}</strong>` : extra}</span>`;
}

/** Call-outs for approvers: Sirocco funding and a GP warning. */
function approvalNotes(p: Project) {
  const b = budgetSplit(p);
  const gp = gpCheck(b.total, p.incremental_volume_hl);
  const box = (bg: string, color: string, html: string) =>
    `<div style="margin:0 0 12px;padding:10px 12px;border-radius:8px;background:${bg};${VALUE};font-size:13px;color:${color}">${html}</div>`;
  return (
    (b.sirocco > 0 ? box("#fff6e0", "#000", `<strong>Includes ${aed(b.sirocco)} of Sirocco funding</strong> (BIF ${aed(b.bif)}).`) : "") +
    (gp && gp.level !== "ok"
      ? box(RED, "#fff", `<strong style="font-family:${FONT};text-transform:uppercase;letter-spacing:.04em">Warning: This investment looks to be GP ${gp.level}</strong><br><span style="font-size:12px">${esc(gpWarningText(gp))}</span>`)
      : "")
  );
}

function summary(p: Project, people: { kam?: string; sm?: string; tm?: string }) {
  return [
    pair(field("Project", `<strong>${esc(projectTitle(p))}</strong><br><span style="color:${GREY};font-size:12px">${esc(p.ref)} · ${esc(p.project_type)}</span>`), field("Status", pill(p))),
    pair(field("Outlet", `<strong>${esc(p.account_name)}</strong><br>${esc(p.parent_name ?? "")}`), field("Budget", budgetHtml(p))),
    pair(field("KAM", esc(people.kam ?? "—")), field("Trade Marketing", esc(people.tm ?? "Not assigned yet"))),
    pair(field("Desired date", date(p.desired_date)), field("Expected completion", date(projectHealth(p).forecast ?? p.target_date))),
  ].join("");
}

function button(href: string, label: string) {
  return `<p style="margin:18px 0 0"><a href="${href}" style="display:inline-block;background:${GREEN};color:#fff;text-decoration:none;font-family:${FONT};text-transform:uppercase;letter-spacing:.05em;font-size:13px;font-weight:700;padding:10px 20px;border-radius:999px">${esc(label)}</a></p>`;
}

function shell(title: string, heading: string, intro: string, body: string) {
  const logo = siteUrl()
    ? `<img src="${siteUrl()}/email-logo-white.png" width="96" alt="SIROCCO" style="display:block;width:96px;height:auto;border:0">`
    : `<span style="font-family:${FONT};font-size:17px;font-weight:700;color:#fff;letter-spacing:.08em">SIROCCO</span>`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${LIGHT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT}"><tr><td align="center" style="padding:16px 8px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:10px;overflow:hidden">
    <tr><td style="background:${GREEN};padding:12px 20px;border-right:6px solid ${RED}">${logo}</td></tr>
    <tr><td style="padding:20px 20px 0">
      <p style="margin:0 0 3px;${LABEL};font-size:11px;letter-spacing:.12em">Commerce Hub · Projects</p>
      <h1 style="margin:0 0 6px;font-family:${FONT};font-weight:700;font-size:21px;line-height:1.15;text-transform:uppercase;color:${GREEN}">${heading}</h1>
      <p style="margin:0 0 16px;${VALUE};color:${GREY}">${intro}</p>
      ${body}
    </td></tr>
    <tr><td style="padding:20px;font-family:${BODY};font-size:11px;color:${GREY}">Sirocco · Commerce Hub</td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export type ProjectEmailKind = "approval_needed" | "sent_back" | "started" | "stage_moved" | "completed";

export function renderProjectEmail(
  kind: ProjectEmailKind,
  p: Project,
  people: { kam?: string; sm?: string; tm?: string },
  extra: { reason?: string; stage?: string } = {},
) {
  const title = projectTitle(p);
  const link = `${siteUrl()}/projects/${p.id}`;
  const table = (rows: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
  const brief = `<div style="margin:0 0 12px;padding:12px;border-radius:8px;background:${LIGHT};${VALUE};font-size:13px;white-space:pre-line">${esc(p.brief.length > 600 ? `${p.brief.slice(0, 600)}…` : p.brief)}</div>`;

  const parts: Record<ProjectEmailKind, { subject: string; heading: string; intro: string; body: string }> = {
    approval_needed: {
      subject: `Approval needed: ${title} (${aed(p.budget_aed)})`,
      heading: "Approval needed",
      intro: `${esc(people.kam)} has requested a ${esc(p.project_type.toLowerCase())} project for <strong>${esc(p.account_name)}</strong>. Please approve or send it back.`,
      body: table(summary(p, people)) + approvalNotes(p) + brief + button(link, "Review request"),
    },
    sent_back: {
      subject: `Sent back: ${title}`,
      heading: "Request sent back",
      intro: `Your request for <strong>${esc(p.account_name)}</strong> needs another look before it can go ahead.`,
      body:
        `<div style="margin:0 0 14px;padding:12px;border-left:4px solid ${RED};background:#fbeeec;${VALUE}">${esc(extra.reason ?? "")}</div>` +
        table(summary(p, people)) +
        button(link, "Update request"),
    },
    started: {
      subject: `Project started: ${title}`,
      heading: "Your project has started",
      intro: `Trade Marketing has started <strong>${esc(title)}</strong>. ${esc(people.tm ?? "Trade Marketing")} owns it and will move it through the stages below.`,
      body: table(summary(p, people)) + stagesTable(p) + button(link, "View project"),
    },
    stage_moved: {
      subject: `${title}: now at ${extra.stage ?? "the next stage"}`,
      heading: `Now at ${esc(extra.stage ?? "the next stage")}`,
      intro: `<strong>${esc(title)}</strong> has moved on.`,
      body: table(summary(p, people)) + stagesTable(p) + button(link, "View project"),
    },
    completed: {
      subject: `Completed: ${title}`,
      heading: "Project completed",
      intro: `<strong>${esc(title)}</strong> for ${esc(p.account_name)} is complete. Remember to check the PICOS promised are in place.`,
      body: table(summary(p, people)) + stagesTable(p) + button(link, "View project"),
    },
  };
  const e = parts[kind];
  return { subject: e.subject, html: shell(e.subject, e.heading, e.intro, e.body) };
}

/** Monday digest: one row per project, most urgent first. */
export function renderDigest(firstName: string, scope: string, projects: Project[], kamName: (p: Project) => string) {
  const live = projects.filter((p) => p.status === "live");
  const behind = live.filter((p) => projectHealth(p).state === "behind").length;
  const waiting = projects.filter((p) => p.status.startsWith("awaiting")).length;
  const stat = (n: number, label: string, color = "#000") =>
    `<td width="33%" style="padding:10px;background:${LIGHT};border-radius:8px;text-align:center"><div style="font-family:${FONT};font-size:24px;font-weight:700;color:${color}">${n}</div><div style="${LABEL}">${label}</div></td>`;
  const rows = projects
    .map((p) => {
      const h = projectHealth(p);
      const where = h.active ? `${esc(h.active.name)} · due ${date(h.active.due_date)}` : esc(STATUS_LABEL[p.status]);
      return `<tr>
        <td style="padding:9px 8px 9px 0;border-bottom:1px solid #eeeded;${VALUE}"><strong>${esc(projectTitle(p))}</strong><div style="font-size:12px;color:${GREY}">${esc(p.account_name)} · ${esc(kamName(p))}</div><div style="font-size:12px;color:${GREY}">${where}</div></td>
        <td align="right" style="padding:9px 0;border-bottom:1px solid #eeeded;vertical-align:top">${pill(p)}</td>
      </tr>`;
    })
    .join("");
  const body =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="margin:0 -6px 10px"><tr>${stat(live.length, "Live")}${stat(behind, "Behind", behind ? RED : "#000")}${stat(waiting, "Awaiting")}</tr></table>` +
    (rows
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><th align="left" colspan="2" style="padding:4px 0;border-bottom:2px solid ${GREEN};${LABEL};font-weight:500">Projects</th></tr>${rows}</table>`
      : `<p style="${VALUE}">No open projects this week.</p>`) +
    button(`${siteUrl()}/projects`, "Open the tracker");
  const subject = `Your projects this week: ${live.length} live${behind ? `, ${behind} behind` : ""}`;
  return { subject, html: shell(subject, "Your week in projects", `Good morning ${esc(firstName)}, here's ${esc(scope)}.`, body) };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** Sends from PROJECTS_EMAIL_FROM (projects@sirocco.ae once set up). Failures are logged, never thrown. */
export async function sendProjectEmail(to: (string | null | undefined)[], email: { subject: string; html: string }, replyTo?: string) {
  const recipients = [...new Set(to.filter((x): x is string => !!x))];
  if (!recipients.length || !process.env.RESEND_API_KEY) return;
  try {
    const from = process.env.PROJECTS_EMAIL_FROM ?? process.env.EMAIL_FROM ?? "Commerce Hub <onboarding@resend.dev>";
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from, to: recipients, replyTo, ...email });
    if (error) console.error("Project email failed", email.subject, error);
  } catch (e) {
    console.error("Project email failed", email.subject, e);
  }
}
