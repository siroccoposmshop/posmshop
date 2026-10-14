"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_DOMAIN, isAllowedEmail } from "@/lib/format";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!isAllowedEmail(clean)) {
      setError(`Only @${ALLOWED_DOMAIN} email addresses can sign in.`);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(destination)}`,
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEmail(clean);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setBusy(false);
    if (error) {
      setError("That code didn't work. Check it or request a new one.");
      return;
    }
    router.replace(destination);
    router.refresh();
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="mt-8 space-y-4">
        <p className="text-sm">
          Code sent to <strong className="text-brand-black">{email}</strong>.
        </p>
        <div>
          <label htmlFor="code" className="label">
            Sign-in code
          </label>
          <input
            id="code"
            className="field text-center text-2xl tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            maxLength={10}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy || code.length < 6}>
          {busy ? "Checking…" : "Sign in"}
        </button>
        <button
          type="button"
          className="w-full text-sm underline"
          onClick={() => {
            setStep("email");
            setCode("");
          }}
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="label">
          Work email
        </label>
        <input
          id="email"
          type="email"
          className="field"
          placeholder={`name@${ALLOWED_DOMAIN}`}
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-brand-red">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Sending…" : "Send code"}
      </button>
    </form>
  );
}
