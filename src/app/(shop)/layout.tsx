import { requireProfile } from "@/lib/auth";
import { CartProvider } from "@/components/CartProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { MobileCartBar } from "@/components/CartButton";
import { Logo } from "@/components/Logo";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <CartProvider userId={profile.id}>
      {/* Column layout keeps the footer at the bottom of the screen on short pages */}
      <div className="flex min-h-dvh flex-col">
        <SiteHeader profile={profile} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-6 sm:px-6 md:pb-16">{children}</main>
        <footer className="no-print relative overflow-hidden border-t border-black/5 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-xs sm:px-6">
            <Logo className="h-7 w-auto" />
            <p>© {new Date().getFullYear()} Sirocco · POSM SHOP · Internal use only</p>
          </div>
        </footer>
      </div>
      <MobileCartBar />
    </CartProvider>
  );
}
