"use client";

import { useDialog } from "@/components/Dialog";
import { useTransition } from "react";
import type { OrderStatus } from "@/lib/types";
import { setOrderStatus } from "../actions";

const STATUSES: OrderStatus[] = ["submitted", "processing", "dispatched", "delivered", "cancelled"];

export function StatusSelect({ id, status }: { id: string; status: OrderStatus }) {
  const [pending, start] = useTransition();
  const dialog = useDialog();
  return (
    <select
      aria-label="Order status"
      className="field !w-36 !py-1.5 text-sm capitalize"
      defaultValue={status}
      disabled={pending}
      onChange={async (e) => {
        const el = e.target;
        const next = el.value as OrderStatus;
        if (
          next === "cancelled" &&
          !(await dialog.confirm({ title: "Cancel this order?", message: "Its stock will be returned.", confirmLabel: "Cancel order", cancelLabel: "Keep order", tone: "danger" }))
        ) {
          el.value = status;
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
