import { requireAdmin } from "@/lib/auth";
import { loadOrderSheetSettings } from "@/lib/order-sheet";

export async function GET() {
  await requireAdmin();
  const s = await loadOrderSheetSettings();
  return new Response(s.template as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${(s.templateName ?? "POS_Order_File.xlsx").replace(/[^\w.\- ]+/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
