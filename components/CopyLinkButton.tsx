"use client";

/**
 * Copies the current page URL to the clipboard. The only client-side bit of the
 * result-page controls — everything else (rank cycling, back-nav) is plain links
 * so the URL stays the source of truth and the route stays shareable.
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
      className="rounded-md border border-gray-300 px-3 py-1.5 hover:border-gray-400"
    >
      {copied ? "Link copied!" : "Copy link"}
    </button>
  );
}
