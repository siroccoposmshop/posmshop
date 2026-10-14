import { MARK_PATH, WORDMARK_PATH } from "./logo-paths";

type Props = {
  variant?: "full" | "mark";
  /** "color" = green mark + grey wordmark; "white" = all white (for green/dark backgrounds) */
  tone?: "color" | "white";
  className?: string;
};

export function Logo({ variant = "full", tone = "color", className }: Props) {
  const markFill = tone === "white" ? "#ffffff" : "var(--color-brand-green)";
  const wordFill = tone === "white" ? "#ffffff" : "var(--color-brand-grey)";
  const viewBox = variant === "full" ? "50 45 2830 1030" : "50 45 950 1030";
  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label="Sirocco">
      <path fill={markFill} fillRule="evenodd" d={MARK_PATH} />
      {variant === "full" && <path fill={wordFill} fillRule="evenodd" d={WORDMARK_PATH} />}
    </svg>
  );
}
