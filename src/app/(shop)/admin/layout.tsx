import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-sm uppercase tracking-wide text-brand-green">Trade Marketing admin</p>
      </div>
      <AdminNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
