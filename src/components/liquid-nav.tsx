"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Tracks whichever child carries data-active="true" and slides a pill behind
// it. useLayoutEffect runs before paint, so the very first position is set
// with no transition to animate from — the slide/squish only happens on
// later nav changes, not on mount. Works for both a horizontal row (desktop
// nav) and a vertical stack (mobile drawer) since it measures all four box
// dimensions rather than assuming a shared row height.
export function LiquidNav({ children, className }: { children: React.ReactNode; className?: string }) {
  const containerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const filterId = useId();
  const [pill, setPill] = useState({ top: 0, left: 0, width: 0, height: 0, opacity: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measure() {
      const active = container!.querySelector<HTMLElement>('[data-active="true"]');
      if (!active) {
        setPill((p) => ({ ...p, opacity: 0 }));
        return;
      }
      const containerRect = container!.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      setPill({
        top: activeRect.top - containerRect.top,
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
        height: activeRect.height,
        opacity: 1,
      });
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname]);

  return (
    <nav ref={containerRef} className={cn("relative flex flex-wrap items-center gap-1", className)}>
      {/* Merges the leader/echo blobs below into one stretchy shape while
          they're apart, and back into a clean pill once they land together. */}
      <svg className="absolute h-0 w-0" aria-hidden>
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      <div
        className="absolute inset-0"
        style={{ filter: `url(#${filterId}) drop-shadow(0 2px 4px rgb(0 0 0 / 0.15))` }}
      >
        {/* Leader: jumps to the new position quickly. */}
        <span
          aria-hidden
          className="absolute rounded-md bg-primary transition-[top,left,width,height] duration-200 ease-out"
          style={{ top: pill.top, left: pill.left, width: pill.width, height: pill.height, opacity: pill.opacity }}
        />
        {/* Echo: same target, deliberately delayed/slower — while it trails
            behind the leader, the goo filter bridges the gap into a stretchy
            liquid connector; once it catches up they merge back into one pill. */}
        <span
          aria-hidden
          className="absolute rounded-md bg-primary transition-[top,left,width,height] duration-300 delay-100 ease-out"
          style={{ top: pill.top, left: pill.left, width: pill.width, height: pill.height, opacity: pill.opacity }}
        />
      </div>
      {children}
    </nav>
  );
}
