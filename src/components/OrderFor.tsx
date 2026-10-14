"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

/** Hotel, outlet and contact for the current order, shown top right beside the page heading. */
export function OrderFor({ showChange = false }: { showChange?: boolean }) {
  const { account, contact } = useCart();
  if (!account) return null;
  return (
    <div className="min-w-0 max-w-[60%] text-right text-xs leading-snug sm:text-sm">
      {account.parent_name && <p className="line-clamp-2 font-medium text-brand-black">{account.parent_name}</p>}
      <p className="truncate">
        {account.name} (#{account.account_number})
      </p>
      {contact && <p className="truncate">{contact.name}</p>}
      {showChange && (
        <Link href="/" className="underline">
          Change
        </Link>
      )}
    </div>
  );
}
