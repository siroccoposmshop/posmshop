import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div>
      <AdminNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
