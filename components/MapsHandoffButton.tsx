"use client";

/**
 * The "Open Full Route in Google Maps" CTA.
 *
 * It is a plain anchor that opens `href` in a new tab — exactly as before. The
 * ONLY addition is an onClick that fires the anonymous 'maps_opened' event so we
 * can count how many users actually leave for Maps.
 *
 * CRITICAL — fire-and-forget, must never block or delay opening Maps:
 *   • We do NOT preventDefault and do NOT call window.open — the native anchor
 *     navigation happens regardless, even if the JS below throws.
 *   • trackMapsOpened only kicks off an insert (never awaited) inside a guard.
 *   • This can slightly undercount (the insert may race the navigation); that's
 *     expected and acceptable — no hacks to force it.
 */
import { trackMapsOpened } from "@/lib/analytics";

export default function MapsHandoffButton({
  href,
  start,
  preference,
  vibe,
}: {
  href: string;
  /** Canonical route fields recorded on the event (vibe stays 'classy'). */
  start: string;
  preference: string;
  vibe: string;
}) {
  function handleClick() {
    // Guarded so a thrown error can never stop the anchor from navigating.
    try {
      trackMapsOpened({ start, preference, vibe });
    } catch {
      // never surface — opening Maps is what matters
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="paper-cta block px-4 py-[15px]"
    >
      <span className="flex items-center justify-center gap-[9px] font-sans text-[13.5px] font-extrabold tracking-[0.2px] text-paper">
        <MapsTarget className="h-4 w-4" /> Open Full Route in Google Maps
      </span>
    </a>
  );
}

/** Gold target/crosshair on the Maps CTA (matches design). */
function MapsTarget({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="6.2" stroke="#e8b24a" strokeWidth="1.7" />
      <circle cx="9" cy="9" r="2.1" fill="#e8b24a" />
    </svg>
  );
}
