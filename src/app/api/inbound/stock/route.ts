import { handleStockEmail, verifyWebhook } from "@/lib/stock-email";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Resend → email.received: IT's stock report arrived. See src/lib/stock-email.ts. */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("Stock email isn't set up (RESEND_WEBHOOK_SECRET).", { status: 503 });
  const body = await request.text();
  if (!verifyWebhook(body, request.headers, secret)) return new Response("Bad signature", { status: 401 });
  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (event.type !== "email.received") return Response.json({ ignored: event.type });
  const result = await handleStockEmail(event as never);
  // Always 200 once verified, so Resend doesn't keep retrying a report we've already logged.
  return Response.json(result);
}
