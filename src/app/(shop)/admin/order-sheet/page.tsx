import { loadOrderSheetSettings } from "@/lib/order-sheet";
import { RulesForm, TemplateForm } from "./Forms";

export const metadata = { title: "Order sheet" };
export const dynamic = "force-dynamic";

export default async function OrderSheetPage() {
  const s = await loadOrderSheetSettings();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="accent-square text-3xl text-brand-black">Order sheet</h1>
        <p className="mt-1 max-w-3xl text-sm">
          The Excel file attached to every POSM order for Customer Service (with the KAM&apos;s copy). It&apos;s their template, filled in
          with the order: one line per item, quantity, case factor Each and unit price 0.
        </p>
      </div>
      <RulesForm rules={s.rules} />
      <TemplateForm custom={s.custom} name={s.templateName} updatedAt={s.updatedAt} />
    </div>
  );
}
