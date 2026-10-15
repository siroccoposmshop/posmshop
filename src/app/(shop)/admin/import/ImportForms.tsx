"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MARKETS } from "@/lib/markets";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/shrink-image";
import { importWorkbook, uploadImageForSku, type ImportSummary } from "../actions";

export function ImportForm() {
  const [state, setState] = useState<{ summary?: ImportSummary; error?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const s = state?.summary;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return setState({ error: "Choose an .xlsx file to upload." });
    setPending(true);
    setState(null);
    try {
      const path = `${new Date().toISOString().replace(/[:.]/g, "-")}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      setStep("Uploading file…");
      const { error } = await createClient().storage.from("imports").upload(path, file, {
        contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      setStep("Reading the workbook and updating items and outlets… this can take a minute.");
      const result = await importWorkbook({ path, filename: file.name, defaultMarket: String(formData.get("defaultMarket") ?? "") });
      setState(result);
      if (!result.error) form.reset();
    } catch (err) {
      setState({ error: err instanceof Error && err.message ? err.message : "Something went wrong. Please try again." });
    } finally {
      setPending(false);
      setStep(null);
    }
  }

  return (
    <div className="bento space-y-4">
      <h2 className="text-xl text-brand-black">Budgeting workbook</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="file"
          name="file"
          disabled={pending}
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
          {pending ? (
            <>
              <Spinner /> Working…
            </>
          ) : (
            "Upload & update"
          )}
        </button>
      </form>
      {pending && step && (
        <p className="rounded-lg bg-brand-light p-3 text-sm" aria-live="polite">
          {step}
        </p>
      )}

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

type FileStatus = { name: string; state: "waiting" | "working" | "done" | "failed"; note?: string };

export function BulkImagesForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [rows, setRows] = useState<FileStatus[]>([]);
  const [finished, setFinished] = useState(false);

  const done = rows.filter((r) => r.state === "done").length;
  const failed = rows.filter((r) => r.state === "failed");
  const processed = done + failed.length;

  // Plain submit handler (not a form action) so progress renders live, file by file.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const files = Array.from((form.elements.namedItem("images") as HTMLInputElement).files ?? []);
    if (!files.length) return;
    setPending(true);
    setFinished(false);
    setRows(files.map((f) => ({ name: f.name, state: "waiting" })));
    const update = (i: number, row: Partial<FileStatus>) =>
      setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...row } : r)));

    for (const [i, file] of files.entries()) {
      update(i, { state: "working" });
      try {
        const fd = new FormData();
        fd.set("image", await shrinkImage(file));
        fd.set("originalName", file.name);
        const res = await uploadImageForSku(fd);
        update(i, res.ok ? { state: "done" } : { state: "failed", note: res.error ?? "Upload failed" });
      } catch (err) {
        update(i, { state: "failed", note: err instanceof Error && err.message ? err.message : "Connection or server error" });
      }
    }
    setPending(false);
    setFinished(true);
    form.reset();
    router.refresh();
  }

  return (
    <div className="bento space-y-4">
      <h2 className="text-xl text-brand-black">Bulk item images</h2>
      <p className="text-sm">
        Name each file with the item&apos;s SKU code, e.g. <code>HKN08.webp</code>. Images are converted to
        1200px-wide .webp and replace any existing image.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="file"
          name="images"
          multiple
          accept="image/*"
          required
          disabled={pending}
          className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-light file:px-4 file:py-2 file:font-display file:uppercase"
        />
        <button className="btn btn-primary w-full" disabled={pending}>
          {pending ? (
            <>
              <Spinner /> Uploading {Math.min(processed + 1, rows.length)} of {rows.length}…
            </>
          ) : (
            "Upload images"
          )}
        </button>
      </form>

      {rows.length > 0 && (
        <div className="space-y-3" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-brand-light">
            <div
              className="h-full bg-brand-green transition-all"
              style={{ width: `${Math.round((processed / rows.length) * 100)}%` }}
            />
          </div>

          {finished && (
            <div
              className={`rounded-lg p-3 text-sm ${
                failed.length ? "bg-brand-red/10 text-brand-red" : "bg-brand-green-tint text-brand-green-dark"
              }`}
            >
              <p className="font-medium">
                {failed.length === 0
                  ? `Done. All ${done} image${done === 1 ? "" : "s"} saved.`
                  : `${done} of ${rows.length} saved. ${failed.length} not saved, see below.`}
              </p>
            </div>
          )}

          <ul className="max-h-72 divide-y divide-black/5 overflow-y-auto rounded-lg border border-black/5 text-sm">
            {rows.map((r) => (
              <li key={r.name} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate">{r.name}</span>
                <span
                  className={`shrink-0 text-xs font-medium ${
                    r.state === "done" ? "text-brand-green" : r.state === "failed" ? "text-brand-red" : "text-brand-grey"
                  }`}
                >
                  {r.state === "waiting" && "Waiting"}
                  {r.state === "working" && (
                    <span className="inline-flex items-center gap-1">
                      <Spinner /> Uploading
                    </span>
                  )}
                  {r.state === "done" && "✓ Saved"}
                  {r.state === "failed" && `✕ ${r.note}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
