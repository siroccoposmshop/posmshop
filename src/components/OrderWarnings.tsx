"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CartLine } from "@/components/CartProvider";
import { ItemImage } from "@/components/ItemImage";

export type OrderWarning = { line: CartLine; text: string };

/** Order warnings (e.g. "Not for consumers") for the items in the cart, read fresh from the database. */
export async function fetchOrderWarnings(lines: CartLine[]): Promise<OrderWarning[]> {
  if (!lines.length) return [];
  const { data, error } = await createClient()
    .from("items")
    .select("id, order_warning")
    .in("id", lines.map((l) => l.item_id))
    .not("order_warning", "is", null);
  if (error) return [];
  return lines.flatMap((line) => {
    const text = data?.find((d) => d.id === line.item_id)?.order_warning?.trim();
    return text ? [{ line, text }] : [];
  });
}

export function useOrderWarnings(lines: CartLine[]) {
  const [warnings, setWarnings] = useState<OrderWarning[]>([]);
  const ids = lines.map((l) => l.item_id).join(",");
  useEffect(() => {
    let cancelled = false;
    fetchOrderWarnings(lines).then((w) => !cancelled && setWarnings(w));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  return warnings;
}

export function OrderWarningList({ warnings }: { warnings: OrderWarning[] }) {
  return (
    <ul className="space-y-3">
      {warnings.map(({ line, text }) => (
        <li key={line.item_id} className="flex items-center gap-3 rounded-lg bg-brand-red/5 p-3 ring-1 ring-brand-red/20">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-brand-light">
            <ItemImage path={line.image_path} alt="" />
          </div>
          <div className="min-w-0">
            <p className="font-medium leading-tight text-brand-black">{line.name}</p>
            <p className="text-xs">SKU {line.sku}</p>
            <p className="mt-1 text-sm font-medium text-brand-red">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
