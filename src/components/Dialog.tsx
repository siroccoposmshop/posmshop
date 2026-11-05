"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The site's own pop-ups, in place of the browser's confirm() / prompt() / alert(), which appear at
 * the top of the window and can't be styled. Centred on the page, in the Sirocco style.
 *
 *   const dialog = useDialog();
 *   if (!(await dialog.confirm({ message: "Move back to Customer approval?" }))) return;
 *   const reason = await dialog.prompt({ title: "Cancel project", message: "Reason (optional)" }); // null = cancelled
 *   await dialog.alert({ message: "Couldn't save." });
 */

type Tone = "primary" | "danger";
type Base = { title?: string; message: React.ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: Tone };
type Request =
  | (Base & { kind: "confirm"; resolve: (v: boolean) => void })
  | (Base & { kind: "prompt"; placeholder?: string; defaultValue?: string; resolve: (v: string | null) => void })
  | (Base & { kind: "alert"; resolve: () => void });

type Api = {
  confirm: (o: Base) => Promise<boolean>;
  prompt: (o: Base & { placeholder?: string; defaultValue?: string }) => Promise<string | null>;
  alert: (o: Base) => Promise<void>;
};

const DialogContext = createContext<Api | null>(null);

export function useDialog(): Api {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useDialog needs <DialogProvider> above it");
  return api;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const confirm = useCallback((o: Base) => new Promise<boolean>((resolve) => setReq({ ...o, kind: "confirm", resolve })), []);
  const prompt = useCallback(
    (o: Base & { placeholder?: string; defaultValue?: string }) => new Promise<string | null>((resolve) => setReq({ ...o, kind: "prompt", resolve })),
    [],
  );
  const alert = useCallback((o: Base) => new Promise<void>((resolve) => setReq({ ...o, kind: "alert", resolve })), []);

  return (
    <DialogContext.Provider value={{ confirm, prompt, alert }}>
      {children}
      {mounted && req && createPortal(<DialogBox req={req} done={() => setReq(null)} />, document.body)}
    </DialogContext.Provider>
  );
}

function DialogBox({ req, done }: { req: Request; done: () => void }) {
  const [value, setValue] = useState(req.kind === "prompt" ? (req.defaultValue ?? "") : "");
  const okRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const finish = useCallback(
    (ok: boolean) => {
      if (req.kind === "confirm") req.resolve(ok);
      else if (req.kind === "prompt") req.resolve(ok ? value : null);
      else req.resolve();
      done();
    },
    [req, value, done],
  );

  useEffect(() => {
    (req.kind === "prompt" ? inputRef.current : okRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [req.kind, finish]);

  const danger = req.tone === "danger";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => finish(false)} aria-hidden />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={req.title ? "dialog-title" : undefined}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          finish(true);
        }}
      >
        <div className={`h-1.5 ${danger ? "bg-brand-red" : "bg-brand-green"}`} aria-hidden />
        <div className="space-y-3 p-5">
          {req.title && (
            <h2 id="dialog-title" className="text-xl text-brand-black">
              {req.title}
            </h2>
          )}
          <div className="text-sm text-brand-black">{req.message}</div>
          {req.kind === "prompt" && (
            <textarea
              ref={inputRef}
              className="field min-h-20"
              placeholder={req.placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  finish(true);
                }
              }}
            />
          )}
          <div className="flex justify-end gap-2 pt-1">
            {req.kind !== "alert" && (
              <button type="button" className="btn btn-secondary" onClick={() => finish(false)}>
                {req.cancelLabel ?? "Cancel"}
              </button>
            )}
            <button ref={okRef} className={`btn ${danger ? "btn-danger" : "btn-primary"}`}>
              {req.confirmLabel ?? "OK"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
