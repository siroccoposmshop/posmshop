import { requireAdmin } from "@/lib/auth";
import { buildTemplate } from "@/lib/excel";

export async function GET() {
  await requireAdmin();
  const buffer = await buildTemplate();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="POSM-SHOP-template.xlsx"',
    },
  });
}
