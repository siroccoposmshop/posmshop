"use client";

import { useState } from "react";
import { MARKETS } from "@/lib/markets";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/shrink-image";
import { importWorkbook, uploadImageForSku, type ImportSummary } from "../actions";

export function ImportForm() {
  const [state, setState] = useState<{ summary?: ImportSummary; error?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const s = state?.summary;

  async function action(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return setState({ error: "Choose an .xlsx file to upload." });
    setPending(true);
    setState(null);
    const path = `${new Date().toISOString().replace(/[:.]/g, "-")}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const { error } = await createClient().storage.from("imports").upload(path, file, {
      contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (error) {
      setPending(false);
      return setState({ error: `Upload failed: ${error.message}` });
    }
    const result = await importWorkbook({ path, filename: file.name, defaultMarket: String(formData.get("defaultMarket") ?? "") });
    setState(result);
    setPending(false);
  }
  return (
    <div className="bento space-y-4">
      <h2 className="text-xl text-brand-black">Budgeting workbook</h2>
      <form action={action} className="space-y-3">
        <input
          type="file"
          name="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-green file:px-4 file:py-2 file:font-display file:uppercase file:text-white"
        />
        <div>
          <label htmlFor="defaultMarket" className="label">
            Market for accounts without one
          </label>
          <select id="defaultMarket" name="defaultMarket" className="field">
            <option value="">Skip them</option>
            {MARKETS.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Importing…" : "Upload & update"}
        </button>
      </form>

      {state?.error && <p className="rounded-lg bg-brand-red/10 p-3 text-sm text-brand-red">{state.error}</p>}
      {s && (
        <div className="space-y-3 rounded-lg bg-brand-green-tint p-4 text-sm">
          <p className="font-display text-lg uppercase text-brand-black">Import complete</p>
          <p>
            Items: <strong>{s.items.created}</strong> new, <strong>{s.items.updated}</strong> updated.
            <br />
            Accounts: <strong>{s.accounts.created}</strong> new, <strong>{s.accounts.updated}</strong> updated
            {s.accounts.skipped ? `, ${s.accounts.skipped} skipped` : ""}.
          </p>
          <details>
            <summary className="cursor-pointer underline">Sheets read</summary>
            <ul className="mt-2 space-y-1">
              {s.sheets.map((sh) => (
                <li key={sh.name}>
                  <strong>{sh.name}</strong>: {sh.kind === "skipped" ? "skipped (no matching headers)" : `${sh.rows} ${sh.kind}`}
                  {sh.kind !== "skipped" && (
                    <span className="block text-xs">
                      {Object.entries(sh.columns)
                        .map(([k, v]) => `${k} ← “${v}”`)
                        .join(" · ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
          {s.missingFromFile.length > 0 && (
            <p>
              {s.missingFromFile.length} existing SKUs weren&apos;t in this file and were left unchanged:{" "}
              {s.missingFromFile.slice(0, 15).join(", ")}
              {s.missingFromFile.length > 15 ? "…" : ""}
            </p>
          )}
          {s.warnings.length > 0 && (
            <ul className="list-inside list-disc text-brand-red">
              {s.warnings.slice(0, 20).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function BulkImagesForm() {
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<{ matched: string[]; unmatched: string[] } | null>(null);

  async function action(formData: FormData) {
    const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return;
    setPending(true);
    setResult(null);
    const matched: string[] = [];
    const unmatched: string[] = [];
    for (const [i, file] of files.entries()) {
      setProgress(`Uploading ${i + 1} of ${files.length}…`);
      const fd = new FormData();
      fd.set("image", await shrinkImage(file));
      fd.set("originalName", file.name);
      const res = await uploadImageForSku(fd);
      (res.ok ? matched : unmatched).push(file.name);
    }
    setResult({ matched, unmatched });
    setProgress(null);
    setPending(false);
  }

  return (
    <div className="bento space-y-4">
      <h2 className="text-xl text-brand-black">Bulk item images</h2>
      <p className="text-sm">
        Name each file with the item&apos;s SKU code, e.g. <code>HNK-GL-25.jpg</code>. Images are converted to
        1200px-wide .webp and replace any existing image.
      </p>
      <form action={action} className="space-y-3">
        <input
          type="file"
          name="images"
          multiple
          accept="image/*"
          required
          className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-light file:px-4 file:py-2 file:font-display file:uppercase"
        />
        <button className="btn btn-secondary w-full" disabled={pending}>
          {pending ? (progress ?? "Uploading…") : "Upload images"}
        </button>
      </form>
      {result && (
        <p className="text-sm">
          {result.matched.length} images saved.
          {result.unmatched.length ? (
            <span className="block text-brand-red">Not saved (no matching SKU or not an image): {result.unmatched.join(", ")}</span>
          ) : null}
        </p>
      )}
    </div>
  );
}
