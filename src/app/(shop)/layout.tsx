import { requireProfile } from "@/lib/auth";
import { CartProvider } from "@/components/CartProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { MobileCartBar } from "@/components/CartButton";
import { Logo } from "@/components/Logo";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <CartProvider userId={profile.id}>
      <SiteHeader profile={profile} />
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-16">{children}</div>
      <footer className="no-print relative overflow-hidden border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 pb-28 text-xs sm:px-6 md:pb-8">
          <Logo className="h-7 w-auto" />
          <p>© {new Date().getFullYear()} Sirocco · POSM SHOP · Internal use only</p>
        </div>
      </footer>
      <MobileCartBar />
    </CartProvider>
  );
}
