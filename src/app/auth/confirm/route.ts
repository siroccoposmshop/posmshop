import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];
const safe = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/");

/**
 * The sign-in link in the Supabase email. Opening it (GET) never signs in: work email link
 * scanners (e.g. Microsoft Defender Safe Links) open every link in an email, which would use up
 * the one-time sign-in, and the code in the same email, before the person does. So GET only shows
 * the "Continue" page; the sign-in happens when someone presses its button (POST).
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const to = new URL("/auth/continue", request.url);
  for (const k of ["token_hash", "type", "next"]) {
    const v = q.get(k);
    if (v) to.searchParams.set(k, v);
  }
  return NextResponse.redirect(to);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const rawType = String(form.get("type") ?? "email") as EmailOtpType;
  const type = TYPES.includes(rawType) ? rawType : "email";
  const next = safe(String(form.get("next") ?? "/"));
  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url), 303);
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url), 303);
}
