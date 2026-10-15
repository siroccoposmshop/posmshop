import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return (data as Profile) ?? null;
});

export async function requireProfile() {
  const profile = await getProfile();
  if (!profile || !profile.active) redirect("/login");
  return profile;
}

/** For server actions called from forms: returns null instead of redirecting, so the page can show a message. */
export async function getAdmin() {
  const profile = await getProfile();
  return profile && profile.active && profile.role === "admin" ? profile : null;
}

export async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/");
  return profile;
}
