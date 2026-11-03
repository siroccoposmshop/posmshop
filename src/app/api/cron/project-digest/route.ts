import { NextResponse, type NextRequest } from "next/server";
import { sendWeeklyDigests } from "@/lib/project-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Monday project digest (vercel.json "crons"), called with "Authorization: Bearer <CRON_SECRET>". */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await sendWeeklyDigests()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Digest failed" }, { status: 500 });
  }
}
