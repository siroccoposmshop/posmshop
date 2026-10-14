"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { sendOrderEmails } from "@/lib/email";
import { normaliseEmail, normaliseMobile } from "@/lib/contact";

const schema = z.object({
  accountId: z.uuid(),
  contact: z.object({
    name: z.string().trim().min(1).max(200),
    mobile: z.string().trim().min(5).max(40),
    email: z.email().max(200),
  }),
  notes: z.string().max(1000).optional().default(""),
  lines: z
    .array(z.object({ item_id: z.uuid(), qty: z.number().int().positive() }))
    .min(1)
    .max(200),
});

export async function placeOrder(
  input: z.input<typeof schema>,
): Promise<{ orderId: string; orderNumber: string; emailNote: string | null } | { error: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Your session has expired. Please sign in again." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Some order details are missing or invalid." };
  const { accountId, notes, lines } = parsed.data;
  const mobile = normaliseMobile(parsed.data.contact.mobile);
  if (!mobile.ok) return { error: mobile.error };
  const email = normaliseEmail(parsed.data.contact.email);
  if (!email.ok) return { error: email.error };
  const contact = { name: parsed.data.contact.name, mobile: mobile.value, email: email.value };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_account_id: accountId,
    p_contact_name: contact.name,
    p_contact_mobile: contact.mobile,
    p_contact_email: contact.email,
    p_notes: notes,
    p_lines: lines,
  });

  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "The order could not be created." };

  let emailNote: string | null = null;
  try {
    const res = await sendOrderEmails(row.order_id);
    emailNote = res.skipped ?? null;
  } catch (e) {
    console.error(e);
    emailNote = "The order was placed but the confirmation emails failed to send.";
  }

  revalidatePath("/shop");
  revalidatePath("/orders");
  return { orderId: row.order_id, orderNumber: row.order_number, emailNote };
}

export async function resendOrderEmails(orderId: string) {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };
  // RLS: only the order's KAM or an admin can see it.
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("id").eq("id", orderId).single();
  if (!data) return { error: "Order not found" };
  const res = await sendOrderEmails(orderId);
  return res.skipped && res.sent === 0 ? { error: res.skipped } : { ok: true, note: res.skipped };
}
