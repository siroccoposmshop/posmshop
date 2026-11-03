import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIso } from "@/lib/working-days";

/** Logs the first visit of each day per person (Admin → Users shows "last seen"). Never blocks the page. */
export async function recordVisit(userId: string) {
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("user_visits")
      .upsert({ user_id: userId, day: todayIso() }, { onConflict: "user_id,day", ignoreDuplicates: true })
      .select("user_id");
    if (data?.length) await db.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", userId);
  } catch {
    // Visit logging is best-effort (e.g. before the Commerce Hub migration has run).
  }
}
