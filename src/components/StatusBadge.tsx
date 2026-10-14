import type { OrderStatus } from "@/lib/types";

const styles: Record<OrderStatus, string> = {
  submitted: "bg-brand-light text-brand-black",
  processing: "bg-amber-100 text-amber-900",
  dispatched: "bg-brand-green-tint text-brand-green-dark",
  delivered: "bg-brand-green text-white",
  cancelled: "bg-brand-red/10 text-brand-red",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${styles[status]}`}>{status}</span>;
}
