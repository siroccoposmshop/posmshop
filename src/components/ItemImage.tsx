import { imageUrl } from "@/lib/format";
import { MARK_PATH } from "./logo-paths";

export function ItemImage({ path, alt, className = "" }: { path: string | null; alt: string; className?: string }) {
  const src = imageUrl(path);
  if (!src) {
    return (
      <div className={`flex h-full w-full items-center justify-center ${className}`}>
        <svg viewBox="50 45 950 1030" className="h-1/2 w-auto opacity-15" aria-hidden>
          <path fill="var(--color-brand-grey)" d={MARK_PATH} />
        </svg>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  // Absolutely positioned so a tall image can't stretch its container; it is scaled down to fit inside,
  // with a 6% margin so items never touch the edges of the image area.
  return (
    <span className="relative block h-full w-full">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`absolute left-[6%] top-[6%] h-[88%] w-[88%] object-contain ${className}`}
      />
    </span>
  );
}
