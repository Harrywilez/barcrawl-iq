/**
 * Shared button "faces" — the decorative innards (two glossy sheen overlays +
 * label, plus the red selected-ring for pills) that the design HTML layers
 * inside each button. They are PURELY presentational: drop one inside an
 * existing <button>/<a>/<Link> and the outer element keeps all of its
 * behaviour (onClick/href/disabled). The matching surface + press styles live
 * on the .btn-hero / .btn-pill / .btn-secondary classes in globals.css.
 *
 * Ported verbatim from design/landing.html + design/result.html so every button
 * stays in sync from one place.
 */
import type { ReactNode } from "react";

/** Red hero CTA innards (See My Route, Open Full Route in Google Maps). */
export function HeroFace({ children }: { children: ReactNode }) {
  return (
    <>
      <span aria-hidden="true" className="btn-hero__sheen-top" />
      <span aria-hidden="true" className="btn-hero__sheen-bottom" />
      <span className="btn-hero__label">{children}</span>
    </>
  );
}

/** Glass toggle-pill innards (vibe + priority). `selected` adds the red ring. */
export function PillFace({
  selected,
  compact,
  children,
}: {
  selected: boolean;
  /** Smaller 11px label for the longer priority words. */
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <span aria-hidden="true" className="btn-pill__sheen-top" />
      <span aria-hidden="true" className="btn-pill__sheen-bottom" />
      {selected && <span aria-hidden="true" className="btn-pill__ring" />}
      <span
        className={
          compact ? "btn-pill__label btn-pill__label--sm" : "btn-pill__label"
        }
      >
        {children}
      </span>
    </>
  );
}

/** Secondary glass-button innards (Show another option, Copy link, Back to start). */
export function SecondaryFace({ children }: { children: ReactNode }) {
  return (
    <>
      <span aria-hidden="true" className="btn-secondary__sheen-top" />
      <span aria-hidden="true" className="btn-secondary__sheen-bottom" />
      <span className="btn-secondary__label">{children}</span>
    </>
  );
}
