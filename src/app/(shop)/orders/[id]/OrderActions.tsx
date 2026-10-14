"use client";

import { useState, useTransition } from "react";
import { formatDate } from "@/lib/format";
import { resendOrderEmails } from "../actions";

export function OrderActions({ orderId, emailsSentAt }: { orderId: string; emailsSentAt: string | null }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs">
        {emailsSentAt ? `Emails sent ${formatDate(emailsSentAt, true)}` : "Emails not sent yet"}
        {msg ? ` · ${msg}` : ""}
      </span>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await resendOrderEmails(orderId);
            setMsg("error" in res ? (res.error ?? "Failed") : "Emails re-sent");
          })
        }
      >
        {pending ? "Sending…" : "Re-send emails"}
      </button>
      <button type="button" className="btn btn-primary" onClick={() => window.print()}>
        Print / PDF
      </button>
    </div>
  );
}
