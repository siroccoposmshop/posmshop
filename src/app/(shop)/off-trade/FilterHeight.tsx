"use client";

import { useEffect, useRef } from "react";

/** Publishes the pinned filter bar's height as --filters-h, so pinned table headings sit just under it. */
export function FilterHeight() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--filters-h", `${form.getBoundingClientRect().height}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(form);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--filters-h");
    };
  }, []);
  return <span ref={ref} hidden />;
}
