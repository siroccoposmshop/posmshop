import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_HUB_SETTINGS, type HubSettings } from "@/lib/hub";

/** Projects settings from hub_settings, or the defaults if the table isn't there yet. */
export async function loadHubSettings(): Promise<HubSettings> {
  const { data, error } = await createAdminClient().from("hub_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return DEFAULT_HUB_SETTINGS;
  return {
    smApprovalAed: Number(data.sm_approval_aed) || DEFAULT_HUB_SETTINGS.smApprovalAed,
    cmApprovalAed: Number(data.cm_approval_aed) || DEFAULT_HUB_SETTINGS.cmApprovalAed,
    gpPerHlUsd: Number(data.gp_per_hl_usd) || DEFAULT_HUB_SETTINGS.gpPerHlUsd,
  };
}
