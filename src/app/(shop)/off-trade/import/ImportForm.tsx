"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/Spinner";
import { importOffTrade, type OffTradeImportSummary } from "../actions";

export function OffTradeImportForm() {
  const router = useRouter();
  const [state, setState] = useState<{ summary?: OffTradeImportSummary; error?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const s = state?.summary;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || file.size === 0) return setState({ error: "Choose an .xlsx file." });
    setPending(true);
    setState(null);
    try {
      const path = `off-trade-${new Date().toISOString().replace(/[:.]/g, "-")}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await createClient().storage.from("imports").upload(path, file, {
        contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      const result = await importOffTrade({ path, filename: file.name });
      setState(result);
      if (!result.error) {
        form.reset();
        router.refresh();
      }
    } catch (err) {
      setState({ error: err instanceof Error && err.message ? err.message : "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bento space-y-3">
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="file"
          name="file"
          disabled={pending}
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-green file:px-4 file:py-2 file:font-display file:uppercase file:text-white"
        />
        <button className="btn btn-primary" disabled={pending}>
          {pending && <Spinner />} {pending ? "Uploading…" : "Upload"}
        </button>
      </form>
      {state?.error && <p className="text-sm text-brand-red">{state.error}</p>}
      {s && (
        <div className="space-y-1 rounded-lg bg-brand-green-tint p-3 text-sm text-brand-green-dark">
          <p className="font-medium">
            ✓ {s.stores} stores ({s.created} new) and {s.projects} projects saved.
          </p>
          {s.unknownStores.length > 0 && <p className="text-brand-red">Projects for unknown store codes were skipped: {s.unknownStores.join(", ")}.</p>}
          {s.warnings.map((w) => (
            <p key={w} className="text-brand-black">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
