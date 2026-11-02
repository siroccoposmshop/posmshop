import { NextResponse, type NextRequest } from "next/server";
import { salesforceConfig } from "@/lib/salesforce";
import { runSalesforceSync } from "@/lib/salesforce-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Nightly Salesforce sync. Called by the host's scheduler (vercel.json "crons") with
 * "Authorization: Bearer <CRON_SECRET>". Any other scheduler can call it the same way.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  // Not connected yet: nothing to do (and nothing to log).
  if (!salesforceConfig()) return NextResponse.json({ ok: true, skipped: "Salesforce not connected" });
  const { ok, summary } = await runSalesforceSync();
  return NextResponse.json({ ok, summary }, { status: ok ? 200 : 500 });
}
