"use client";

import { useActionState, useTransition } from "react";
import type { OrderSheetRules } from "@/lib/order-sheet";
import { resetOrderTemplate, saveOrderSheetRules, uploadOrderTemplate } from "./actions";

function Field({ name, label, value, hint, wide }: { name: keyof OrderSheetRules; label: string; value: string | number; hint?: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={`os-${name}`}>
        {label}
      </label>
      <input id={`os-${name}`} name={name} defaultValue={String(value)} className="field" />
      {hint && <p className="mt-1 text-xs">{hint}</p>}
    </div>
  );
}

export function RulesForm({ rules }: { rules: OrderSheetRules }) {
  const [state, action, pending] = useActionState(saveOrderSheetRules, null);
  return (
    <form action={action} className="bento space-y-5">
      <div>
        <h2 className="text-xl text-brand-black">Rules</h2>
        <p className="text-sm">Where each piece of the order goes in the template. A column is a letter (D); a cell is a letter and row (F2).</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-display text-sm uppercase tracking-wide text-brand-black">Header</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field name="accountNameCell" label="Account name cell" value={rules.accountNameCell} />
          <Field name="customerCodeCell" label="Customer code cell" value={rules.customerCodeCell} />
          <Field name="orderNumberCell" label="PO / order number cell" value={rules.orderNumberCell} hint="Our order number, e.g. POSM-50300-12." />
          <Field
            name="customerCodeFormat"
            label="Customer code format"
            value={rules.customerCodeFormat}
            hint="{account} = account number, {company} = the market's company code (Admin → Markets), e.g. 50308_M10."
            wide
          />
          <div>
            <label className="label" htmlFor="os-accountLevel">Account used</label>
            <select id="os-accountLevel" name="accountLevel" defaultValue={rules.accountLevel} className="field">
              <option value="outlet">The outlet ordered for</option>
              <option value="parent">Its parent account</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-sm uppercase tracking-wide text-brand-black">Item lines</legend>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Field name="firstItemRow" label="First item row" value={rules.firstItemRow} hint="The template's sample lines from here down are replaced." />
          <Field name="codeCol" label="Item code column" value={rules.codeCol} />
          <Field name="nameCol" label="Item name column" value={rules.nameCol} />
          <Field name="qtyCol" label="Quantity column" value={rules.qtyCol} />
          <Field name="caseFactorCol" label="Case factor column" value={rules.caseFactorCol} hint="Blank to leave out." />
          <Field name="caseFactorValue" label="Case factor value" value={rules.caseFactorValue} hint="Always the primary unit: Each." />
          <Field name="unitPriceCol" label="Unit price column" value={rules.unitPriceCol} hint="Blank to leave out." />
          <Field name="unitPriceValue" label="Unit price" value={rules.unitPriceValue} hint="0 when submitting at this stage." />
          <Field name="totalCol" label="Line total column" value={rules.totalCol} hint="Quantity × unit price. Blank to leave out." />
        </div>
      </fieldset>

      {state?.error && <p className="text-sm text-brand-red">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : state?.ok ? "Saved ✓" : "Save rules"}
      </button>
    </form>
  );
}

export function TemplateForm({ custom, name, updatedAt }: { custom: boolean; name: string | null; updatedAt: string | null }) {
  const [state, action, pending] = useActionState(uploadOrderTemplate, null);
  const [resetting, startReset] = useTransition();
  return (
    <section className="bento space-y-4">
      <div>
        <h2 className="text-xl text-brand-black">Template</h2>
        <p className="text-sm">
          In use: <strong className="text-brand-black">{custom ? name : "the built-in Customer Service template (POS_Order_File.xlsx)"}</strong>
          {custom && updatedAt ? `, uploaded ${new Date(updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href="/admin/order-sheet/template" className="btn btn-secondary !py-1.5 text-sm" download>
          ⬇ Download the template in use
        </a>
        <a href="/admin/order-sheet/sample" className="btn btn-secondary !py-1.5 text-sm" download>
          ⬇ Download a sample order file
        </a>
        {custom && (
          <button type="button" className="btn btn-secondary !py-1.5 text-sm" disabled={resetting} onClick={() => startReset(async () => void (await resetOrderTemplate()))}>
            {resetting ? "Resetting…" : "Go back to the built-in template"}
          </button>
        )}
      </div>
      <form action={action} className="space-y-2 border-t border-black/10 pt-4">
        <label className="label" htmlFor="os-file">Upload a new template (.xlsx)</label>
        <input
          id="os-file"
          type="file"
          name="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-green file:px-4 file:py-2 file:font-display file:uppercase file:text-white"
        />
        <p className="text-xs">The first sheet is used. After uploading, check the rules above still point at the right cells, then download a sample.</p>
        {state?.error && <p className="text-sm text-brand-red">{state.error}</p>}
        {state?.message && <p className="text-sm text-brand-green-dark">{state.message}</p>}
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Uploading…" : "Upload template"}
        </button>
      </form>
    </section>
  );
}
