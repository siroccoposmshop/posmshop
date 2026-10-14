import { requireProfile } from "@/lib/auth";
import { PasswordForm } from "./PasswordForm";

export const metadata = { title: "Change password" };

export default async function AccountPage() {
  const profile = await requireProfile();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="accent-square text-4xl text-brand-black">Change password</h1>
      <p className="mt-2 text-sm">Signed in as {profile.email}</p>
      <PasswordForm />
    </div>
  );
}
