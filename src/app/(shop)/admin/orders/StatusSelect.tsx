"use client";

import { useTransition } from "react";
import type { OrderStatus } from "@/lib/types";
import { setOrderStatus } from "../actions";

const STATUSES: OrderStatus[] = ["submitted", "processing", "dispatched", "delivered", "cancelled"];

export function StatusSelect({ id, status }: { id: string; status: OrderStatus }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Order status"
      className="field !w-36 !py-1.5 text-sm capitalize"
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as OrderStatus;
        if (next === "cancelled" && !confirm("Cancel this order? Its stock will be returned.")) {
          e.target.value = status;
          return;
        }
        start(() => setOrderStatus(id, next));
      }}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
