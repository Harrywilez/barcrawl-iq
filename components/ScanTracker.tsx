"use client";

/**
 * Fires the anonymous 'scan' event once when the landing page (/e/les) mounts.
 * Renders nothing. Fire-and-forget — see lib/analytics.
 */
import { useEffect } from "react";
import { trackScan } from "@/lib/analytics";

export default function ScanTracker({
  sourceBarId,
}: {
  sourceBarId: string | null;
}) {
  useEffect(() => {
    trackScan(sourceBarId);
  }, [sourceBarId]);

  return null;
}
