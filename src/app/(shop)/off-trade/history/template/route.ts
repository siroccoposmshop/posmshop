import { requireProfile } from "@/lib/auth";
import { canUseOffTrade } from "@/lib/off-trade";
import { buildHistoryTemplate } from "@/lib/off-trade-excel";

export async function GET() {
  const profile = await requireProfile();
  if (!canUseOffTrade(profile)) return new Response("Not allowed", { status: 403 });
  const buffer = await buildHistoryTemplate();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="off-trade-history-template.xlsx"',
    },
  });
}
