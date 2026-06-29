"use client";

/**
 * Copies the current page URL to the clipboard (Paper design). The only
 * client-side bit of the result controls — everything else is plain links so
 * the URL stays the source of truth and the route stays shareable.
 */
import { useState } from "react";

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
    <button
      type="button"
      onClick={copy}
      className="paper-card paper-press min-w-0 flex-1 px-1.5 py-3 text-center"
    >
      <span className="flex items-center justify-center gap-1.5 whitespace-nowrap font-sans text-[12px] font-bold text-ink">
        {copied ? (
          <CheckIcon className="h-[13px] w-[13px]" />
        ) : (
          <CopyIcon className="h-[13px] w-[13px]" />
        )}
        {copied ? "Link copied!" : "Copy link"}
      </span>
    </button>
  );
}

/** Two overlapping rounded rects — matches design (notCopied state). */
function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 15 15" fill="none" className={className} aria-hidden="true">
      <rect x="2.4" y="4.4" width="7.2" height="8.4" rx="2" stroke="rgba(24,48,92,0.55)" strokeWidth="1.4" />
      <rect x="5.4" y="1.8" width="7.2" height="8.4" rx="2" stroke="rgba(24,48,92,0.55)" strokeWidth="1.4" />
    </svg>
  );
}

/** Red checkmark shown briefly after copying — matches design (copied state). */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" fill="none" className={className} aria-hidden="true">
      <path d="M2.4 7.4l3 3 6.2-6.8" stroke="#c5302f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
