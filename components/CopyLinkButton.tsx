"use client";

/**
 * Copies the current page URL to the clipboard. The only client-side bit of the
 * result-page controls — everything else (rank cycling, back-nav) is plain links
 * so the URL stays the source of truth and the route stays shareable.
 *
 * Phase 6.2: secondary glass-button reskin (.btn-secondary + SecondaryFace) with
 * the design's copy/check icons. The copy behaviour is unchanged.
 */
import { useState } from "react";
import { SecondaryFace } from "./ButtonFaces";

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context) — fail quietly.
    }
  }

  return (
    <button type="button" onClick={copy} className="btn-secondary flex-1">
      <SecondaryFace>
        {copied ? (
          <CheckIcon className="h-[13px] w-[13px]" />
        ) : (
          <CopyIcon className="h-[13px] w-[13px]" />
        )}
        {copied ? "Link copied!" : "Copy link"}
      </SecondaryFace>
    </button>
  );
}

/** Two overlapping rounded rects — matches design/result. */
function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 15 15" fill="none" className={className} aria-hidden="true">
      <rect
        x="2.4"
        y="4.4"
        width="7.2"
        height="8.4"
        rx="2"
        stroke="rgba(246,244,238,0.9)"
        strokeWidth="1.4"
      />
      <rect
        x="5.4"
        y="1.8"
        width="7.2"
        height="8.4"
        rx="2"
        stroke="rgba(246,244,238,0.9)"
        strokeWidth="1.4"
      />
    </svg>
  );
}

/** Gold checkmark shown briefly after copying — matches design/result. */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" fill="none" className={className} aria-hidden="true">
      <path
        d="M2.4 7.4l3 3 6.2-6.8"
        stroke="#ffd9b0"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
