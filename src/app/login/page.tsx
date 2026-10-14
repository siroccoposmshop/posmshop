import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-brand-green p-12 text-white lg:flex lg:flex-col lg:justify-between lg:pb-48">
        <Logo tone="white" className="h-14 w-auto self-start" />
        <div>
          <h1 className="accent-square text-6xl xl:text-7xl">
            POSM
            <br />
            SHOP
          </h1>
          <p className="mt-6 max-w-md text-lg text-white/90">
            Order point-of-sale materials for your accounts across Dubai, Abu Dhabi and the Northern Emirates.
          </p>
        </div>
        <div
          aria-hidden
          className="hyper-logotype pointer-events-none absolute -bottom-8 left-8 whitespace-nowrap text-[11rem] [-webkit-text-stroke-color:rgba(255,255,255,0.25)]"
        >
          SIROCCO
        </div>
        <div className="absolute inset-y-0 right-0 w-3 bg-brand-red" aria-hidden />
      </section>

      <section className="flex flex-col justify-center px-5 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="mb-10 h-12 w-auto lg:hidden" />
          <h2 className="text-3xl text-brand-black">Sign in</h2>
          <p className="mt-2 text-sm">
            Use your <strong>@sirocco.ae</strong> email. We&apos;ll email you a sign-in code. You stay
            signed in on this device.
          </p>
          {error === "link" && (
            <p className="mt-4 rounded-lg bg-brand-red/10 p-3 text-sm text-brand-red">
              That sign-in link has expired. Request a new code below.
            </p>
          )}
          <LoginForm next={next} />
        </div>
      </section>
    </main>
  );
}
