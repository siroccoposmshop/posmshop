"use client";

import { useActionState, useState } from "react";
import { USD_TO_AED, formatAed, type HubSettings } from "@/lib/hub";
import type { StageType } from "@/lib/projects";
import { addStageType, saveHubSettings, saveStageType } from "./actions";

function SaveButton({ pending, ok, label = "Save" }: { pending: boolean; ok?: boolean; label?: string }) {
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Saving…" : ok ? "Saved ✓" : label}
    </button>
  );
}

export function SettingsForm({ settings }: { settings: HubSettings }) {
  const [state, action, pending] = useActionState(saveHubSettings, null);
  const [gp, setGp] = useState(String(settings.gpPerHlUsd));
  const gpAed = (Number(gp) || 0) * USD_TO_AED;
  return (
    <form action={action} className="bento space-y-4">
      <div>
        <h2 className="text-xl text-brand-black">Approvals &amp; GP check</h2>
        <p className="text-sm">Used for new requests and approvals from now on.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="s-sm">SM approval from (AED)</label>
          <input id="s-sm" name="sm_approval_aed" className="field" inputMode="decimal" defaultValue={settings.smApprovalAed} />
          <p className="mt-1 text-xs">Budgets from this amount need the Sales Manager.</p>
        </div>
        <div>
          <label className="label" htmlFor="s-cm">CM/TMM approval from (AED)</label>
          <input id="s-cm" name="cm_approval_aed" className="field" inputMode="decimal" defaultValue={settings.cmApprovalAed} />
          <p className="mt-1 text-xs">From this amount CM/TMM approve too.</p>
        </div>
        <div>
          <label className="label" htmlFor="s-gp">GP per incremental HL (USD)</label>
          <input id="s-gp" name="gp_per_hl_usd" className="field" inputMode="decimal" value={gp} onChange={(e) => setGp(e.target.value)} />
          <p className="mt-1 text-xs">
            = {formatAed(gpAed)} per HL at {USD_TO_AED} (fixed, as POSM prices).
          </p>
        </div>
      </div>
      {state?.error && <p className="text-sm text-brand-red">{state.error}</p>}
      <SaveButton pending={pending} ok={state?.ok} />
    </form>
  );
}

export function StageRow({ stage }: { stage: StageType }) {
  const [state, action, pending] = useActionState(saveStageType, null);
  const [dirty, setDirty] = useState(false);
  const formId = `stage-${stage.key}`;
  return (
    <tr className={stage.active === false ? "opacity-60" : ""} onChange={() => setDirty(true)}>
      <td className="w-16">
        <form id={formId} action={(fd) => { setDirty(false); return action(fd); }}>
          <input type="hidden" name="key" value={stage.key} />
        </form>
        <input form={formId} name="sort" type="number" defaultValue={stage.sort} className="field !w-16 !px-2 !py-1.5 text-center text-sm" aria-label="Order" />
      </td>
      <td>
        <input form={formId} name="name" defaultValue={stage.name} className="field !py-1.5 text-sm" aria-label="Stage name" />
      </td>
      <td className="w-24">
        <input form={formId} name="default_days" type="number" min={1} max={250} defaultValue={stage.default_days} className="field !w-20 !px-2 !py-1.5 text-center text-sm" aria-label="Default working days" />
      </td>
      <td className="w-20 text-center">
        <input form={formId} name="active" type="checkbox" defaultChecked={stage.active !== false} className="h-4 w-4 accent-brand-green" aria-label="Offer for new projects" />
      </td>
      <td className="w-28 whitespace-nowrap text-right">
        <button form={formId} className={`btn !px-3 !py-1.5 text-xs ${dirty ? "btn-primary" : "btn-secondary"}`} disabled={pending}>
          {pending ? "Saving…" : state?.ok && !dirty ? "Saved ✓" : "Save"}
        </button>
        {state?.error && <p className="mt-1 text-xs text-brand-red">{state.error}</p>}
      </td>
    </tr>
  );
}

export function AddStage({ trade = "on" }: { trade?: "on" | "off" }) {
  const [state, action, pending] = useActionState(addStageType, null);
  const [key, setKey] = useState(0);
  return (
    <form
      key={key}
      action={async (fd) => {
        await action(fd);
        setKey((k) => k + 1);
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="trade" value={trade} />
      <div className="min-w-48 flex-1">
        <label className="label" htmlFor={`new-stage-${trade}`}>Add a stage</label>
        <input id={`new-stage-${trade}`} name="name" className="field" placeholder="e.g. Permits" />
      </div>
      <div>
        <label className="label" htmlFor={`new-days-${trade}`}>Days</label>
        <input id={`new-days-${trade}`} name="default_days" type="number" min={1} max={250} defaultValue={5} className="field !w-20 text-center" />
      </div>
      <button className="btn btn-secondary" disabled={pending}>{pending ? "Adding…" : "+ Add"}</button>
      {state?.error && <p className="w-full text-sm text-brand-red">{state.error}</p>}
    </form>
  );
}
