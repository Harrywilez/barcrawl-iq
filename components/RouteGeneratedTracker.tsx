"use client";

/**
 * Fires the anonymous 'route_generated' event once per (start, preference, vibe)
 * when the result page mounts. The deps below don't include rank, and the
 * analytics layer dedupes per combo, so cycling ranks does NOT re-count.
 * Renders nothing. Fire-and-forget — see lib/analytics.
 */
import { useEffect } from "react";
import { trackRouteGenerated } from "@/lib/analytics";

export default function RouteGeneratedTracker({
  start,
  preference,
  vibe,
}: {
  start: string;
  preference: string;
  vibe: string;
}) {
  useEffect(() => {
    trackRouteGenerated({ start, preference, vibe });
  }, [start, preference, vibe]);

  return null;
}
