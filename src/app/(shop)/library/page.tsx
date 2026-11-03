import Link from "next/link";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "Marketing Library" };

export default async function LibraryPage() {
  await requireProfile();
  return (
    <div className="mx-auto max-w-2xl">
      <section className="relative overflow-hidden rounded-[var(--radius-bento)] bg-white p-8 ring-1 ring-black/5 sm:p-12">
        <div className="absolute inset-y-0 right-0 w-2 bg-brand-red" aria-hidden />
        <p className="font-display text-sm uppercase tracking-[0.15em]">Coming soon</p>
        <h1 className="accent-square mt-1 text-4xl text-brand-black sm:text-5xl">Marketing Library</h1>
        <p className="mt-4">
          A showcase of projects Sirocco has delivered, with images, documents, estimated costs and timelines. You&apos;ll be able
          to browse it by brand or by project type: bars, activations, furniture, cladding, fridges and brunch stations.
        </p>
        <p className="mt-3 text-sm">Until then, brief a new project and Trade Marketing will share relevant examples.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/projects/new" className="btn btn-primary">
            + New project
          </Link>
          <Link href="/" className="btn btn-secondary">
            Back to the Hub
          </Link>
        </div>
      </section>
    </div>
  );
}
