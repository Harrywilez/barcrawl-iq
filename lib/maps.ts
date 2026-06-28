/**
 * Build a Google Maps walking-directions deep link from an ordered list of bars.
 *
 * Format (per Google's Maps URLs API, ?api=1 directions mode):
 *   https://www.google.com/maps/dir/?api=1
 *     &origin=<text>
 *     &destination=<text>
 *     &waypoints=<text>|<text>
 *     &travelmode=walking
 *
 * origin      = first bar
 * destination = last bar
 * waypoints   = every bar in between, joined by a literal "|"
 *
 * Each stop is passed as URL-encoded "Name, Address" TEXT (not bare lat/lng) so
 * Google labels the pins with the venue name instead of a raw coordinate. The
 * `bars` table has no place_id column, and the ?api=1 format takes a single
 * value per stop, so text is the signal — Phase 1 already cross-checked each
 * name+address against Google's location (<150 m), so these resolve cleanly.
 */
import type { Bar } from "./types";

/** "Iggy's Keltic Lounge, 88 Avenue A, New York, NY 10009" -> URL-encoded. */
function stopQuery(bar: Bar): string {
  return encodeURIComponent(`${bar.bar_name}, ${bar.address}`);
}

export function buildWalkingMapsUrl(orderedBars: Bar[]): string {
  if (orderedBars.length < 2) {
    throw new Error("buildWalkingMapsUrl needs at least 2 bars (origin + destination).");
  }

  const origin = orderedBars[0];
  const destination = orderedBars[orderedBars.length - 1];
  const waypoints = orderedBars.slice(1, -1);

  const params = [
    "api=1",
    `origin=${stopQuery(origin)}`,
    `destination=${stopQuery(destination)}`,
  ];
  if (waypoints.length > 0) {
    // Encode each stop, but keep the "|" separator literal (Google expects it).
    params.push(`waypoints=${waypoints.map(stopQuery).join("|")}`);
  }
  params.push("travelmode=walking");

  return `https://www.google.com/maps/dir/?${params.join("&")}`;
}
