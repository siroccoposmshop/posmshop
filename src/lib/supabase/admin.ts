import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client. Only call after verifying the caller is an admin (see requireAdmin). */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
