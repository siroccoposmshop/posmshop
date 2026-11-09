import { Logo } from "@/components/Logo";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

/**
 * Where the email's sign-in button lands. Nothing is used up until "Continue" is pressed, so work
 * email link scanners that open the link first don't spend the sign-in (or the code).
 */
export default async function ContinuePage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const { token_hash, type, next } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand-light px-5 py-12">
      <div className="bento w-full max-w-sm space-y-5 text-center">
        <div className="flex items-center justify-center gap-3">
          <Logo className="h-11 w-auto" />
          <span className="border-l border-brand-grey/30 pl-3 font-display text-lg font-medium uppercase tracking-wide text-brand-black">Commerce Hub</span>
        </div>
        {token_hash ? (
          <form method="post" action="/auth/confirm" className="space-y-4">
            <input type="hidden" name="token_hash" value={token_hash} />
            <input type="hidden" name="type" value={type ?? "email"} />
            <input type="hidden" name="next" value={next ?? "/"} />
            <h1 className="text-2xl text-brand-black">{type === "invite" ? "Accept your invite" : "Sign in"}</h1>
            <p className="text-sm">Press the button to finish signing in on this device.</p>
            <button className="btn btn-primary w-full">{type === "invite" ? "Accept and sign in" : "Continue to sign in"}</button>
          </form>
        ) : (
          <div className="space-y-3">
            <h1 className="text-2xl text-brand-black">Link incomplete</h1>
            <p className="text-sm">This sign-in link is missing a part. Request a new code on the sign-in page.</p>
            <a href="/login" className="btn btn-primary w-full">
              Go to sign in
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
