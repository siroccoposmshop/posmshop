"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ItemImage } from "@/components/ItemImage";
import { shrinkImage } from "@/lib/shrink-image";
import { removeItemImage, uploadItemImage } from "../../actions";

export function ImageManager({ id, path, name }: { id: string; path: string | null; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function upload(formData: FormData) {
    const file = formData.get("image");
    if (!(file instanceof File) || file.size === 0) return;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("image", await shrinkImage(file));
      const res = await uploadItemImage(null, fd);
      if (res.error) setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="bento h-fit space-y-3">
      <h2 className="text-lg text-brand-black">Image</h2>
      <div className="aspect-[4/3] overflow-hidden rounded-lg bg-brand-light">
        <ItemImage path={path} alt={name} />
      </div>
      <form action={upload} className="space-y-2">
        <input
          type="file"
          name="image"
          accept="image/*"
          required
          className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-light file:px-4 file:py-2 file:font-display file:uppercase"
        />
        <p className="text-xs">Any JPG, PNG or WebP. It&apos;s converted to a 1200px-wide .webp automatically.</p>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <button className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Working…" : path ? "Replace image" : "Upload image"}
        </button>
      </form>
      {path && (
        <button
          type="button"
          className="btn btn-danger w-full"
          disabled={pending}
          onClick={() =>
            confirm("Remove this image?") &&
            start(async () => {
              await removeItemImage(id);
              router.refresh();
            })
          }
        >
          Remove image
        </button>
      )}
    </div>
  );
}
