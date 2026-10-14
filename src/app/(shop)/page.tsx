import { requireProfile } from "@/lib/auth";
import { AccountStep } from "./AccountStep";

export const metadata = { title: "New order" };

export default async function OrderStartPage() {
  const profile = await requireProfile();

  if (profile.role !== "admin" && !profile.market) {
    return (
      <div className="bento mx-auto max-w-xl text-center">
        <h1 className="text-3xl text-brand-black">Almost there</h1>
        <p className="mt-3">
          Your login works, but Trade Marketing hasn&apos;t assigned you to a market yet. Once they do,
          you&apos;ll see your accounts here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-display text-sm uppercase tracking-wide text-brand-green">Step 1 of 3</p>
      <h1 className="accent-square mt-1 text-4xl text-brand-black sm:text-5xl">New order</h1>
      <p className="mt-2">
        Choose the account and the contact who should receive the order confirmation.
        {profile.role === "admin"
          ? " As an admin you can see accounts in every market."
          : ` Showing accounts in ${profile.market}.`}
      </p>
      <AccountStep />
    </div>
  );
}
