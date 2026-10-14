"use client";

import { usePathname } from "next/navigation";

/** "ADMIN" label in the centre of the header on admin pages (mobile — desktop shows the highlighted Admin tab). */
export function AdminBadge() {
  const pathname = usePathname();
  if (!pathname.startsWith("/admin")) return null;
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-green px-4 py-1 font-display text-sm font-medium uppercase tracking-widest text-white md:hidden">
      Admin
    </span>
  );
}
